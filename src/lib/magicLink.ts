import { createHash, randomBytes } from 'node:crypto'

import { sql } from 'drizzle-orm'
import type { PayloadRequest } from 'payload'
import { ValidationError } from 'payload'

import { campaignPath } from '@/lib/campaigns'
import { createCitizenSession } from '@/lib/citizenSession'
import { getDb } from '@/lib/db'
import { isLocale, type Locale } from '@/lib/locale'
import { createSignature, readPendingSignature } from '@/lib/signatures'
import { createSubmission, readPendingSubmission } from '@/lib/submissions'
import type { Citizen, MagicLink } from '@/payload-types'

const MAGIC_LINK_TTL_MS = 30 * 60 * 1000 // 30 min — distinct from the 6-month session TTL

const hashToken = (rawToken: string): string => createHash('sha256').update(rawToken).digest('hex')

/**
 * Issues a magic link and returns the raw token to the caller. The raw value
 * is never persisted — only its SHA-256 (`magic-links.tokenHash`) is, "so a
 * leaked table must not grant anyone a session" (see the collection). The
 * environment-gated decision to also expose it in an HTTP response (the
 * dev/e2e shortcut) lives in `endpoints/magicLink.ts`, not here — this
 * function always returns it, regardless of environment.
 */
export const createMagicLink = async (
  req: PayloadRequest,
  {
    email,
    pseudo,
    lang,
    intent,
  }: { email: string; pseudo: string; lang: Locale; intent?: MagicLink['intent'] },
): Promise<{ rawToken: string; expiresAt: Date }> => {
  const rawToken = randomBytes(32).toString('base64url')
  const tokenHash = hashToken(rawToken)
  const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MS)

  // `pseudo` and `lang` are supplied now, at request time, but only consumed
  // later, at redemption time (`consumeMagicLink`, a separate call, possibly
  // minutes apart) — so they have to travel via the row, not a function
  // argument. `intent.payload` already exists for exactly this ("the pending
  // submission or signature, written once the link is confirmed"), so they
  // are merged into it whatever the intent type is, rather than every caller
  // having to remember to include them.
  //
  // Storing `lang` here (rather than trusting it back from the verify URL's
  // own query string) also means the *redirect target* on a successful
  // redemption never depends on request-controlled input — only the
  // already-`isLocale`-validated failure-path fallback still reads the query
  // string, because on an invalid/unknown token there is no row to read it
  // back from.
  const resolvedIntent: MagicLink['intent'] = {
    type: intent?.type ?? 'login',
    payload: { ...(intent?.payload as Record<string, unknown> | undefined), pseudo, lang },
  }

  await req.payload.create({
    collection: 'magic-links',
    data: { email, tokenHash, expiresAt: expiresAt.toISOString(), intent: resolvedIntent },
    req,
  })

  return { rawToken, expiresAt }
}

/**
 * Read directly from the env var, not `payload.config.serverURL` — that
 * config field is deliberately left unset (see `payload.config.ts`): setting
 * it flips every upload's `url` field from relative to absolute app-wide,
 * which needs its own `next.config.ts` changes and has a documented history
 * of unrelated Payload bugs (redirect loops, doubled origins). Magic links
 * are the one place an absolute origin is actually needed, so they read the
 * env var here instead of leaking that need into the global config.
 */
export const getServerURL = (): string =>
  process.env.PAYLOAD_PUBLIC_SERVER_URL || 'http://localhost:3000'

/** Subject + first line per intent — the only thing that differs between the flows. */
const EMAIL_COPY: Record<MagicLink['intent']['type'], { subject: string; lead: string }> = {
  login: {
    subject: 'Ton lien de connexion mobibi',
    lead: 'Clique sur ce lien pour te connecter à mobibi',
  },
  'petition-signature': {
    subject: 'Confirme ta signature',
    lead: 'Clique sur ce lien pour confirmer ta signature',
  },
  'interpellation-submission': {
    subject: 'Confirme ton interpellation',
    lead: 'Clique sur ce lien pour confirmer ton interpellation',
  },
}

const emailCopy = (intent: MagicLink['intent'], verifyURL: string) => {
  const { subject, lead } = EMAIL_COPY[intent.type]
  return {
    subject,
    text: `${lead} (valable 30 minutes) :\n\n${verifyURL}\n\nSi tu n'es pas à l'origine de cette demande, ignore ce message.`,
  }
}

/**
 * Issues a magic link AND emails it, so the verify URL is built in one place.
 * Every flow that needs one reaches this through `issueMagicLink`
 * (`endpoints/magicLink.ts`), which owns the HTTP side — the body fields, the
 * error responses and the envelope — whatever the pending action is.
 *
 * Returns the raw token. Whether to *also* hand it back over HTTP (the
 * dev/e2e shortcut) stays an endpoint decision, not one made here.
 */
export const sendMagicLink = async (
  req: PayloadRequest,
  {
    email,
    pseudo,
    lang,
    intent,
  }: { email: string; pseudo: string; lang: Locale; intent?: MagicLink['intent'] },
): Promise<string> => {
  const { rawToken } = await createMagicLink(req, { email, pseudo, lang, intent })

  const verifyURL = `${getServerURL()}/api/citizens/magic-link/verify?token=${encodeURIComponent(rawToken)}&lang=${encodeURIComponent(lang)}`

  await req.payload.sendEmail({
    to: email,
    ...emailCopy(intent ?? { type: 'login' }, verifyURL),
  })

  return rawToken
}

/**
 * Reads back the `{ pseudo, lang }` stashed in an intent's payload, if any.
 * Every intent type carries them — they are supplied at request time and only
 * consumed at redemption time, whatever the pending action is.
 */
const pendingLoginPayload = (intent: MagicLink['intent']): { pseudo?: string; lang?: Locale } => {
  const value = intent.payload
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const record = value as Record<string, unknown>
  return {
    pseudo: typeof record.pseudo === 'string' ? record.pseudo : undefined,
    lang: typeof record.lang === 'string' && isLocale(record.lang) ? record.lang : undefined,
  }
}

/**
 * Atomically claims a magic link for single use. Returns `true` only for the
 * one caller that flips `used_at` from null — a concurrent second call on the
 * same token sees a non-null `used_at` in its own `WHERE` clause and updates
 * zero rows. Whoever loses the race performs no further writes: no second
 * session, and — once a later slice performs a submission/signature write
 * inside `consumeMagicLink` — no double-counted action from one click.
 *
 * `RETURNING id`, checked via the returned rows rather than a driver-specific
 * "rows affected" count, so this doesn't depend on the exact result shape a
 * given Postgres driver returns for `.execute()`.
 */
const claimMagicLink = async (req: PayloadRequest, id: number | string): Promise<boolean> => {
  const result = await getDb(req).execute(
    sql`UPDATE magic_links SET used_at = ${new Date().toISOString()} WHERE id = ${id} AND used_at IS NULL RETURNING id`,
  )
  const rows = Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows
  return Boolean(rows?.length)
}

/**
 * The page a redeemed link lands on, for either campaign collection. Built
 * entirely from stored values — the campaign's own slugs and the `lang` from
 * the intent payload — never from the verify request, which is what keeps this
 * from being an open redirect. Falls back to the locale's home whenever the
 * campaign can't be resolved, so a broken row is a dull landing, not a 500.
 */
const campaignRedirect = async (
  req: PayloadRequest,
  collection: 'petitions' | 'interpellations',
  id: number,
  lang: Locale,
): Promise<string> => {
  const campaign = await req.payload.findByID({ collection, id, depth: 1, req }).catch(() => null)

  const organization = campaign?.organization
  if (!campaign || typeof organization !== 'object') return `/${lang}`

  return campaignPath(lang, organization.slug, campaign.slug)
}

/**
 * Performs the action the link was issued for, and returns where the citizen
 * should land. Called from `consumeMagicLink` only, on the far side of the
 * atomic claim — so a link that loses the single-use race performs no write,
 * and one click can never count twice.
 *
 * Every arm ends in `campaignRedirect` above, which is what keeps the
 * destination out of request-controlled input — the same reasoning as the
 * comment on `createMagicLink` about `lang`.
 */
const performIntent = async (
  req: PayloadRequest,
  intent: MagicLink['intent'],
  citizen: Citizen,
  lang: Locale,
): Promise<string> => {
  const home = `/${lang}`

  // No « you just signed / just interpellated » flag on any of these URLs: a
  // campaign page is a pure function of what is stored, so a redemption, a
  // reload and a direct write all render the same thing.
  switch (intent.type) {
    case 'petition-signature': {
      const pending = readPendingSignature(intent.payload)
      if (!pending) return home

      try {
        await createSignature(req, citizen.id, pending)
      } catch (error) {
        // ONLY the one-signature-per-citizen rule is swallowed: the citizen
        // signed from another device between requesting this link and clicking
        // it, the link is already burnt, and the destination page resolves the
        // signed state itself. Anything else — the database being down, a hook
        // throwing — must propagate: the link is burnt either way, and
        // redirecting to a « merci » page for a signature that was never
        // written is worse than the link reporting itself as broken.
        if (!(error instanceof ValidationError)) throw error
      }

      return campaignRedirect(req, 'petitions', pending.petitionId, lang)
    }

    case 'interpellation-submission': {
      const pending = readPendingSubmission(intent.payload)
      if (!pending) return home

      // Nothing swallowed here, unlike the signature arm above: repeat
      // submissions for the same (citizen, target, channel) are legal, so
      // there is no duplicate rule to forgive — any error is a real one.
      await createSubmission(req, citizen.id, pending)

      return campaignRedirect(req, 'interpellations', pending.campaignId, lang)
    }

    default:
      return home
  }
}

/**
 * Redeems a raw token: validates it, claims it (single-use), finds-or-creates
 * the citizen, establishes a session, and performs whatever action the link
 * carried. Returns `null` for any invalid, expired, already-used, or unknown
 * token — never throws for those cases, so callers can treat `null` uniformly
 * as "this link doesn't work any more".
 */
export const consumeMagicLink = async (
  req: PayloadRequest,
  rawToken: string,
): Promise<{ citizen: Citizen; cookie: string; lang: Locale; redirectTo: string } | null> => {
  const { payload } = req
  const tokenHash = hashToken(rawToken)

  const { docs } = await payload.find({
    collection: 'magic-links',
    where: { tokenHash: { equals: tokenHash } },
    limit: 1,
    req,
  })
  const link = docs[0]
  if (!link || link.usedAt || new Date(link.expiresAt) < new Date()) return null

  // The atomic claim is the fix for the race above. Whoever loses it stops here.
  if (!(await claimMagicLink(req, link.id))) return null

  const { pseudo: pendingPseudo, lang } = pendingLoginPayload(link.intent)

  const { docs: existing } = await payload.find({
    collection: 'citizens',
    where: { email: { equals: link.email } },
    limit: 1,
    req,
  })
  let citizen: Citizen | undefined = existing[0]

  if (citizen) {
    // Only reachable when an admin pre-created this row (e.g. importing paper-petition signers)
    // with `emailVerified` left at its default `false` — a citizen created by the branch below is
    // always already verified, so this is the one place "verified" and "exists" diverge.
    if (!citizen.emailVerified) {
      citizen = await payload.update({
        collection: 'citizens',
        id: citizen.id,
        data: { emailVerified: true },
        req,
      })
    }
  } else {
    // `createMagicLink` takes a required `pseudo`, so a link that reaches
    // here without one in its payload predates that rule (or was written by
    // hand). Refuse rather than invent a public display name out of the
    // email — this is a « that link doesn't work any more » case, and the
    // 30-minute TTL means it stops being reachable on its own.
    if (!pendingPseudo) return null

    citizen = await payload.create({
      collection: 'citizens',
      // Verified by construction: this row exists only because a magic link
      // was just redeemed — no separate follow-up write needed.
      data: { email: link.email, pseudo: pendingPseudo, emailVerified: true },
      req,
    })
  }

  const cookie = await createCitizenSession(req, citizen.id)
  const resolvedLang = lang ?? 'fr'
  const redirectTo = await performIntent(req, link.intent, citizen, resolvedLang)

  return { citizen, cookie, lang: resolvedLang, redirectTo }
}
