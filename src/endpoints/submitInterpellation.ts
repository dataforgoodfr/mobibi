import type { Endpoint, PayloadRequest } from 'payload'
import { APIError } from 'payload'

import { issueMagicLink, readJsonBody, readLang } from '@/endpoints/magicLink'
import { createSubmission, type PendingSubmission } from '@/lib/submissions'
import type { CampaignTarget } from '@/payload-types'

type Channel = NonNullable<CampaignTarget['channels']>[number]

/**
 * Turns the client's answers into the `feedback` snapshot. The client only
 * ever sends `{ index, value }` — the label is looked up in the channel's own
 * `feedbackFields`, in the locale it was asked in. So the stored label is
 * guaranteed to be the one actually shown (CLAUDE.md's « Snapshot, don't
 * reference »), and a client cannot invent labels for a row admins will read.
 *
 * `index` is the position in the RAW `feedbackFields` array — the same
 * convention `resolveTarget` (`src/lib/resolveTarget.ts`) emits when it builds
 * the form. The two are the only places that interpret this index, and they
 * have to agree. Exactly `buildResponses` in `endpoints/signPetition.ts`, one
 * collection over.
 */
const buildFeedback = (
  channel: Channel,
  answers: unknown,
): PendingSubmission['feedback'] | undefined => {
  if (!Array.isArray(answers)) return undefined
  const fields = channel.feedbackFields ?? []

  const feedback = answers.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const { index, value } = entry as Record<string, unknown>
    const label = fields[Number(index)]?.label
    if (!label || typeof value !== 'string' || !value.trim()) return []
    return [{ label, value: value.trim() }]
  })

  return feedback.length > 0 ? feedback : undefined
}

/**
 * « J'ai interpellé ». Two outcomes, one endpoint — the interpellation twin of
 * `endpoints/signPetition.ts`:
 *
 * - a citizen with a session is counted immediately (`submitted`) — a session
 *   is only ever minted by magic-link redemption, so they are verified by
 *   construction and nothing else needs checking;
 * - anyone else gets a magic link carrying the declaration as its intent
 *   (`link-sent`), written only once they click it. Per CLAUDE.md: no
 *   optimistic counters, the citizen acts before having an account.
 *
 * Mounted on `campaign-targets` rather than on `interpellations` because the
 * target is the thing acted on, and it carries its own campaign — so the
 * campaign never has to be trusted from the request body.
 */
export const submitInterpellation: Endpoint = {
  path: '/:id/interpellate',
  method: 'post',
  handler: async (req: PayloadRequest) => {
    const targetId = req.routeParams?.id
    if (!targetId) throw new APIError('Missing target id', 400)

    const body = await readJsonBody(req)
    const lang = readLang(body.lang)

    // `overrideAccess: false` so a draft campaign's target 404s here exactly
    // as it does on its page — `publishedCampaignOrAdminViaCampaign` is the
    // rule doing that work. `locale` matters: it decides which
    // `feedbackFields` labels get snapshotted.
    const target = await req.payload
      .findByID({
        collection: 'campaign-targets',
        id: targetId as string,
        depth: 0,
        locale: lang,
        req,
        overrideAccess: false,
      })
      .catch(() => null)

    if (!target) throw new APIError('Not found', 404)

    // `depth: 0` above, so this is the id — the branch only satisfies the type.
    const campaignId = typeof target.campaign === 'number' ? target.campaign : target.campaign.id
    const campaign = await req.payload
      .findByID({ collection: 'interpellations', id: campaignId, depth: 0, req })
      .catch(() => null)

    if (!campaign || campaign.status !== 'active') {
      return Response.json(
        { error: "Cette campagne n'est plus ouverte aux interpellations." },
        { status: 400 },
      )
    }

    const channelId = typeof body.channelId === 'string' ? body.channelId : ''
    const channel = (target.channels ?? []).find((row) => row.id === channelId)

    if (!channel) {
      return Response.json(
        { error: 'Ce canal n’existe plus pour cette personne.' },
        { status: 400 },
      )
    }

    const pending: PendingSubmission = {
      targetId: target.id,
      campaignId,
      channelId,
      // Snapshot: the association may edit or remove the channel afterwards,
      // and the record must still say how the citizen made contact.
      channelType: channel.type,
      feedback: buildFeedback(channel, body.feedback),
    }

    if (req.user?.collection === 'citizens') {
      await createSubmission(req, req.user.id, pending)
      return Response.json({ status: 'submitted' })
    }

    return issueMagicLink(req, {
      body,
      lang,
      intent: { type: 'interpellation-submission', payload: pending },
    })
  },
}
