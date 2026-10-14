import type { ChannelType } from '@/fields/channels'
import type { CampaignTarget, Interpellation } from '@/payload-types'

/**
 * A free-text question shown on the « j'ai interpellé » form. The index is the
 * position in the channel's RAW `feedbackFields` array — what the form posts
 * back, so the server can snapshot the label itself rather than trust the
 * client's copy (`endpoints/submitInterpellation.ts`). Same convention, and
 * the same reason, as `CampaignAdditionalField` in `src/lib/campaigns.ts`.
 */
export type ResolvedFeedbackField = {
  index: number
  label: string
}

export type ResolvedChannel = {
  id: string
  type: ChannelType
  value: string
  /** Campaign default, overridden by the target's own message when set. */
  message: string
  subject?: string
  feedbackFields: ResolvedFeedbackField[]
}

export type ResolvedTarget = {
  // `campaign-targets.id` is a number on this adapter (see `payload-types.ts`);
  // widening it to `number | string` here only forced every consumer to narrow
  // it back — `mine.byTarget` is keyed on it, and the endpoint URL embeds it.
  id: number
  firstName: string
  lastName: string
  fullName: string
  initials: string
  role: string
  politicalGroup?: string
  district?: string
  tags: string[]
  submissionCount: number
  channels: ResolvedChannel[]
}

/**
 * Substitute the placeholders a campaign-wide template may carry, so one template
 * serves every target. `@{handle}` in the prototype's Twitter message.
 */
export const renderMessage = (
  template: string,
  target: Pick<CampaignTarget, 'firstName' | 'lastName' | 'role'>,
  channelValue: string,
): string =>
  template
    .replace(/\{handle\}/g, channelValue.replace(/^@/, ''))
    .replace(/\{firstName\}/g, target.firstName ?? '')
    .replace(/\{lastName\}/g, target.lastName ?? '')
    .replace(/\{role\}/g, target.role ?? '')

/**
 * THE read path for a campaign target. Components must not reach into the raw
 * document: when a shared `targets` collection is introduced, the fallback
 * (`row.lastName ?? row.target.lastName`) lands here and nowhere else.
 */
export const resolveTarget = (
  target: CampaignTarget,
  campaign: Pick<Interpellation, 'defaultMessages'>,
): ResolvedTarget => {
  const firstName = target.firstName ?? ''
  const lastName = target.lastName ?? ''

  const channels: ResolvedChannel[] = (target.channels ?? []).map((channel) => {
    const fallback = (campaign.defaultMessages ?? []).find(
      (message) => message.channelType === channel.type,
    )

    const template = channel.message ?? fallback?.body ?? ''

    return {
      id: channel.id ?? '',
      type: channel.type,
      value: channel.value,
      message: renderMessage(template, target, channel.value),
      subject: fallback?.subject ?? undefined,
      // The index kept is the position in the RAW array, not in the filtered
      // result — see `ResolvedFeedbackField`.
      feedbackFields: (channel.feedbackFields ?? []).flatMap((field, index) =>
        field.label ? [{ index, label: field.label }] : [],
      ),
    }
  })

  return {
    id: target.id,
    firstName,
    lastName,
    fullName: [firstName, lastName].filter(Boolean).join(' '),
    initials: [firstName[0], lastName[0]].filter(Boolean).join('').toUpperCase(),
    role: target.role ?? '',
    politicalGroup: target.politicalGroup ?? undefined,
    district: target.district ?? undefined,
    tags: (target.tags ?? []).filter((tag): tag is string => Boolean(tag)),
    submissionCount: target.submissionCount ?? 0,
    channels,
  }
}
