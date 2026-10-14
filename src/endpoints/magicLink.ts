import type { Endpoint, PayloadRequest } from 'payload'
import { ValidationError } from 'payload'

import { consumeMagicLink, getServerURL, sendMagicLink } from '@/lib/magicLink'
import { isLocale, type Locale, PUBLIC_LOCALES } from '@/lib/locale'
import type { MagicLink } from '@/payload-types'

export const readLang = (value: unknown): (typeof PUBLIC_LOCALES)[number] =>
  typeof value === 'string' && isLocale(value) ? value : 'fr'

/**
 * `req.data` is only auto-populated for Payload's *internal* endpoints —
 * `wrapInternalEndpoints` (`node_modules/payload/dist/utilities/wrapInternalEndpoints.js`)
 * runs `addDataAndFileToRequest` around the built-in `/login`, `/logout`, …
 * handlers specifically, and custom `collection.endpoints` entries (these)
 * are never wrapped that way. Parse the body directly instead.
 */
export const readJsonBody = async (req: PayloadRequest): Promise<Record<string, unknown>> => {
  try {
    return (await req.json?.()) ?? {}
  } catch {
    return {}
  }
}

/**
 * THE « anonymous visitor gets a link » path, shared by all three endpoints
 * that end that way: « Se connecter » (below), « Je signe la pétition »
 * (`signPetition.ts`) and « J'ai interpellé » (`submitInterpellation.ts`).
 * Each of them reads the same two fields off the body, rejects the same two
 * ways, and hands back the same envelope — so the identity-collection rules
 * live here rather than in three near-copies that can drift apart.
 *
 * Returns a ready `Response` for every outcome, error or not: the callers'
 * remaining job is to decide the intent, which is the only thing that actually
 * differs between them.
 *
 * The email always goes out (via whatever `payload.config.email` adapter is
 * configured — see `src/lib/email.ts`, which in dev logs the full body, link
 * included, to the console). Outside production the response ALSO carries the
 * raw token, so e2e tests can jump straight to `verifyMagicLinkRedirect`
 * without a real inbox; no modal ever reads it, and a human developer copies
 * the link from the terminal like anyone else.
 */
export const issueMagicLink = async (
  req: PayloadRequest,
  {
    body,
    lang,
    intent,
  }: { body: Record<string, unknown>; lang: Locale; intent?: MagicLink['intent'] },
): Promise<Response> => {
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  // Required even when only signing in: the link may create the account, and
  // `citizens.pseudo` is the only name a citizen is ever displayed under.
  const pseudo = typeof body.pseudo === 'string' ? body.pseudo.trim() : ''

  if (!email) {
    return Response.json({ error: 'Une adresse email est requise.' }, { status: 400 })
  }

  if (!pseudo) {
    return Response.json({ error: 'Un pseudo est requis.' }, { status: 400 })
  }

  let rawToken: string
  try {
    rawToken = await sendMagicLink(req, { email, pseudo, lang, intent })
  } catch (error) {
    if (error instanceof ValidationError) {
      return Response.json({ error: 'Cette adresse email ne semble pas valide.' }, { status: 400 })
    }
    throw error
  }

  return Response.json({
    status: 'link-sent',
    email,
    ...(process.env.NODE_ENV !== 'production' ? { devToken: rawToken } : {}),
  })
}

/** Requests a plain sign-in link — no pending action attached. */
export const requestMagicLink: Endpoint = {
  path: '/magic-link',
  method: 'post',
  handler: async (req: PayloadRequest) => {
    const body = await readJsonBody(req)
    return issueMagicLink(req, { body, lang: readLang(body.lang) })
  },
}

/**
 * The URL a real emailed link points at. Always redirects — a citizen
 * clicking a link in their mail client expects to land back in the app, not
 * see raw JSON. Sets the session cookie on success and follows the
 * destination the intent decided (`performIntent`, in `src/lib/magicLink.ts`:
 * the locale's home for a plain login, the petition page for a signature); on
 * failure, redirects to the same locale's home with a query flag the UI can
 * read.
 */
export const verifyMagicLinkRedirect: Endpoint = {
  path: '/magic-link/verify',
  method: 'get',
  handler: async (req: PayloadRequest) => {
    const url = new URL(req.url ?? '', 'http://localhost')
    const token = url.searchParams.get('token')
    // Only ever used for the *failure* redirect below, where there's no
    // magic-link row left to read a trustworthy `lang` back from. On success,
    // `result.redirectTo` — built from the row, not this request's query
    // string — is what decides the destination.
    const fallbackLang = readLang(url.searchParams.get('lang'))

    const result = token ? await consumeMagicLink(req, token) : null

    const serverURL = getServerURL()
    const destination = result
      ? `${serverURL}${result.redirectTo}`
      : `${serverURL}/${fallbackLang}?magicLink=expired`

    const headers = new Headers({ Location: destination })
    if (result) headers.append('Set-Cookie', result.cookie)

    return new Response(null, { status: 302, headers })
  },
}
