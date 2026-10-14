import type { Payload, PayloadRequest } from 'payload'

/**
 * An interpellation the citizen has declared but that is not written yet — the
 * shape stashed in `magic-links.intent.payload` while an anonymous visitor
 * goes and clicks their link, and the argument `createSubmission` takes in
 * both paths (direct write and redemption) so the two can't drift.
 *
 * `channelType` and `feedback[].label` are snapshots of what the citizen
 * actually saw, built server-side from the target's own channel — see
 * `endpoints/submitInterpellation.ts`.
 */
export type PendingSubmission = {
  targetId: number
  campaignId: number
  channelId: string
  /**
   * `string`, deliberately not `ChannelType`. This is a historical fact, not
   * live configuration: `CHANNEL_TYPES` can lose a value and every stored
   * row that carried it must stay representable. Same reason
   * `interpellation-submissions.channelType` is a `text` field rather than
   * a `select`.
   */
  channelType: string
  feedback?: { label: string; value?: string }[]
}

/**
 * Validates a `magic-links.intent.payload` — a `json` field, so `unknown` on
 * the way out — back into a `PendingSubmission`. Returns `null` for anything
 * that isn't one, so `consumeMagicLink` can skip the write rather than throw
 * on a malformed row. The twin of `readPendingSignature`.
 */
export const readPendingSubmission = (value: unknown): PendingSubmission | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>

  const targetId = Number(record.targetId)
  const campaignId = Number(record.campaignId)
  if (!Number.isFinite(targetId) || !Number.isFinite(campaignId)) return null
  if (typeof record.channelId !== 'string' || typeof record.channelType !== 'string') return null

  const feedback = Array.isArray(record.feedback)
    ? record.feedback.flatMap((entry) => {
        if (!entry || typeof entry !== 'object') return []
        const { label, value: answer } = entry as Record<string, unknown>
        if (typeof label !== 'string') return []
        return [{ label, value: typeof answer === 'string' ? answer : undefined }]
      })
    : undefined

  return {
    targetId,
    campaignId,
    channelId: record.channelId,
    channelType: record.channelType,
    feedback,
  }
}

/**
 * THE interpellation write path, shared by the direct write
 * (`endpoints/submitInterpellation.ts`, for a citizen who already has a
 * session) and by magic-link redemption (`lib/magicLink.ts`, for one who
 * didn't) — the same way `createSignature` (`lib/signatures.ts`) owns the
 * signature side. A plain Local API create: both counters (the target's and
 * the campaign's) move in `hooks/counters.ts`, so both paths get them for free.
 *
 * Nothing here rejects a repeat: multiple submissions for the same (citizen,
 * target, channel) are allowed by design, and the counter counts submissions,
 * not people.
 */
export const createSubmission = async (
  req: PayloadRequest,
  citizenId: number,
  pending: PendingSubmission,
): Promise<void> => {
  await req.payload.create({
    collection: 'interpellation-submissions',
    data: {
      citizen: citizenId,
      target: pending.targetId,
      campaign: pending.campaignId,
      channelId: pending.channelId,
      channelType: pending.channelType,
      feedback: pending.feedback?.map(({ label, value }) => ({ label, value })),
    },
    req,
  })
}

/**
 * What this citizen has already done on this campaign — the read counterpart of
 * `createSubmission`, the way `hasSigned` sits beside `createSignature`.
 *
 * One query for the whole page rather than one per card: the rows are folded
 * into a map keyed by target id, which the target list and the header's stat
 * card both read. `total` is returned rather than summed by callers so the two
 * can't disagree about what « tes interpellations » counts.
 *
 * `total` comes from the query's own `totalDocs`, so it stays exact past the
 * row limit below — only `byTarget` truncates there, and a citizen with 500+
 * submissions on one campaign would lose per-target marks, never the total.
 *
 * Anonymous visitors never call this — `EMPTY_SUBMISSIONS` stands in, so no
 * component has to branch on "is there a session" as well as "did they act".
 */
export type CitizenSubmissions = {
  total: number
  /** targetId → how many times, and when the most recent one was. */
  byTarget: Record<number, { count: number; lastAt: string }>
}

export const EMPTY_SUBMISSIONS: CitizenSubmissions = { total: 0, byTarget: {} }

export const getCitizenSubmissions = async (
  payload: Payload,
  campaignId: number,
  citizenId: number,
): Promise<CitizenSubmissions> => {
  const { docs, totalDocs } = await payload.find({
    collection: 'interpellation-submissions',
    where: { and: [{ campaign: { equals: campaignId } }, { citizen: { equals: citizenId } }] },
    // Newest first, so the first row seen for a target is its `lastAt`.
    sort: '-createdAt',
    select: { target: true, createdAt: true },
    depth: 0,
    // Caps the rows folded into `byTarget`, not the total — see above. Matches
    // the ceilings in `lib/campaigns.ts`; this is not a paginated read.
    limit: 500,
  })

  const byTarget: CitizenSubmissions['byTarget'] = {}

  for (const submission of docs) {
    const targetId =
      typeof submission.target === 'number' ? submission.target : submission.target.id
    const seen = byTarget[targetId]
    if (seen) seen.count += 1
    else byTarget[targetId] = { count: 1, lastAt: submission.createdAt }
  }

  return { total: totalDocs, byTarget }
}
