import type { Payload, PayloadRequest } from 'payload'

import type { Citizen } from '@/payload-types'

export type RecentSignature = { pseudo: string; city?: string; createdAt: string }

/**
 * A signature the citizen has filled in but that is not written yet — the
 * shape stashed in `magic-links.intent.payload` while an anonymous visitor
 * goes and clicks their link, and the argument `createSignature` takes in
 * both paths (direct write and redemption) so the two can't drift.
 *
 * `responses[].label` is a snapshot of the label as shown, built server-side
 * from the petition's own `additionalFields` — see `endpoints/signPetition.ts`.
 */
export type PendingSignature = {
  petitionId: number
  city?: string
  responses?: { label: string; value?: string }[]
}

/**
 * The « Dernières signatures » read path, shared by the campaign page
 * (`src/lib/campaigns.ts`, through the Local API) and the public
 * `/api/petitions/:id/recent-signatures` endpoint (which still does its own
 * `overrideAccess: false` visibility check and limit clamping — only the
 * query-and-map lives here). Returns pseudo + city + date only, never the
 * citizen's email, so `petition-signatures.read` can stay admin-only.
 *
 * The query below does not itself check the petition's visibility.
 */
export const listRecentSignatures = async (
  payload: Payload,
  petitionId: number | string,
  limit = 8,
  req?: PayloadRequest,
): Promise<RecentSignature[]> => {
  const { docs } = await payload.find({
    collection: 'petition-signatures',
    where: { petition: { equals: petitionId } },
    sort: '-createdAt',
    limit,
    depth: 1,
    req,
  })

  return docs.map((signature) => {
    const citizen = signature.citizen as Citizen | number

    return {
      // `depth: 1` above always populates the relation, and `citizens.pseudo`
      // is required — the empty string is unreachable, not a fallback name.
      pseudo: typeof citizen === 'object' ? citizen.pseudo : '',
      city: signature.city ?? undefined,
      createdAt: signature.createdAt,
    }
  })
}

/**
 * Validates a `magic-links.intent.payload` — a `json` field, so `unknown` on
 * the way out — back into a `PendingSignature`. Returns `null` for anything
 * that isn't one, so `consumeMagicLink` can skip the write rather than throw
 * on a malformed row.
 */
export const readPendingSignature = (value: unknown): PendingSignature | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>

  const petitionId = Number(record.petitionId)
  if (!Number.isFinite(petitionId)) return null

  const responses = Array.isArray(record.responses)
    ? record.responses.flatMap((entry) => {
        if (!entry || typeof entry !== 'object') return []
        const { label, value: answer } = entry as Record<string, unknown>
        if (typeof label !== 'string') return []
        return [{ label, value: typeof answer === 'string' ? answer : undefined }]
      })
    : undefined

  return {
    petitionId,
    city: typeof record.city === 'string' ? record.city : undefined,
    responses,
  }
}

/**
 * The signature write path, shared by the direct write (`endpoints/signPetition.ts`,
 * for a citizen who already has a session) and by magic-link redemption
 * (`lib/magicLink.ts`, for one who didn't). A plain Local API create: the
 * one-signature-per-citizen rule (`collections/PetitionSignatures.ts`) and the
 * counter bump (`hooks/counters.ts`) are collection hooks, so both paths get
 * them for free — and a duplicate throws a `ValidationError` here, which each
 * caller handles in its own way.
 */
export const createSignature = async (
  req: PayloadRequest,
  citizenId: number,
  pending: PendingSignature,
): Promise<void> => {
  await req.payload.create({
    collection: 'petition-signatures',
    data: {
      citizen: citizenId,
      petition: pending.petitionId,
      city: pending.city,
      responses: pending.responses?.map(({ label, value }) => ({ label, value })),
    },
    req,
  })
}

/** Powers the « Tu as signé ✓ » state on the petition page. */
export const hasSigned = async (
  payload: Payload,
  petitionId: number,
  citizenId: number,
): Promise<boolean> => {
  const { totalDocs } = await payload.count({
    collection: 'petition-signatures',
    where: {
      and: [{ petition: { equals: petitionId } }, { citizen: { equals: citizenId } }],
    },
  })

  return totalDocs > 0
}
