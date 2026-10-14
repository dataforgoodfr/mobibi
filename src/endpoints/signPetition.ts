import type { Endpoint, PayloadRequest } from 'payload'
import { APIError, ValidationError } from 'payload'

import { issueMagicLink, readJsonBody, readLang } from '@/endpoints/magicLink'
import { createSignature, type PendingSignature } from '@/lib/signatures'
import type { Petition } from '@/payload-types'

/**
 * Turns the client's answers into the `responses` snapshot. The client only
 * ever sends `{ index, value }` — the label is looked up in the petition's own
 * `additionalFields`, in the locale it was asked in. So the stored label is
 * guaranteed to be the one actually shown (CLAUDE.md's « Snapshot, don't
 * reference »), and a client cannot invent labels for a row admins will read.
 *
 * `index` is the position in the RAW `additionalFields` array — the same
 * convention `resolveAdditionalFields` (`src/lib/campaigns.ts`) emits when it
 * builds the form. The two are the only places that interpret this index, and
 * they have to agree.
 */
const buildResponses = (
  petition: Petition,
  answers: unknown,
): PendingSignature['responses'] | undefined => {
  if (!Array.isArray(answers)) return undefined
  const fields = petition.additionalFields ?? []

  const responses = answers.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const { index, value } = entry as Record<string, unknown>
    const label = fields[Number(index)]?.label
    if (!label || typeof value !== 'string' || !value.trim()) return []
    return [{ label, value: value.trim() }]
  })

  return responses.length > 0 ? responses : undefined
}

/**
 * « Je signe la pétition ». Two outcomes, one endpoint:
 *
 * - a citizen with a session signs immediately (`signed`) — a session is only
 *   ever minted by magic-link redemption, so they are verified by construction
 *   and nothing else needs checking;
 * - anyone else gets a magic link carrying the filled-in form as its intent
 *   (`link-sent`), written only once they click it. Per CLAUDE.md: no
 *   optimistic counters, the citizen acts before having an account.
 */
export const signPetition: Endpoint = {
  path: '/:id/sign',
  method: 'post',
  handler: async (req: PayloadRequest) => {
    const petitionId = req.routeParams?.id
    if (!petitionId) throw new APIError('Missing petition id', 400)

    const body = await readJsonBody(req)
    const lang = readLang(body.lang)

    // `overrideAccess: false` so a draft petition 404s here exactly as it does
    // on its page — same guard as `endpoints/recentSignatures.ts`. `locale`
    // matters: it decides which `additionalFields` labels get snapshotted.
    const petition = await req.payload
      .findByID({
        collection: 'petitions',
        id: petitionId as string,
        depth: 0,
        locale: lang,
        req,
        overrideAccess: false,
      })
      .catch(() => null)

    if (!petition) throw new APIError('Not found', 404)

    if (petition.status !== 'active') {
      return Response.json(
        { error: "Cette pétition n'est plus ouverte à la signature." },
        { status: 400 },
      )
    }

    const pending: PendingSignature = {
      petitionId: petition.id,
      city: typeof body.city === 'string' ? body.city.trim() || undefined : undefined,
      responses: buildResponses(petition, body.responses),
    }

    // Signed in: the account already carries a pseudo (`citizens.pseudo` is
    // required), so nothing about the identity is submitted here — only the
    // signature itself.
    if (req.user?.collection === 'citizens') {
      try {
        await createSignature(req, req.user.id, pending)
      } catch (error) {
        // The one-signature-per-citizen hook. Not an error the citizen did
        // anything wrong with — the UI just says they already signed.
        if (error instanceof ValidationError) return Response.json({ status: 'already-signed' })
        throw error
      }
      return Response.json({ status: 'signed' })
    }

    return issueMagicLink(req, {
      body,
      lang,
      intent: { type: 'petition-signature', payload: pending },
    })
  },
}
