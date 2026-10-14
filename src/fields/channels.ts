import type { Field } from 'payload'

import { requiredInDefaultLocale } from './validation'

/**
 * Every type here must be actionable end-to-end: the « interpeller » flow
 * (`components/interpellation/interpeller-modal.tsx`) builds a deep link per
 * type, so adding one means adding its link too — otherwise an admin can
 * configure a channel the public flow can only ever show as inert text.
 */
export const CHANNEL_TYPES = ['email', 'twitter', 'instagram', 'phone'] as const

export type ChannelType = (typeof CHANNEL_TYPES)[number]

export const channelTypeField = (overrides: Partial<Field> = {}): Field =>
  ({
    name: 'type',
    type: 'select',
    required: true,
    options: CHANNEL_TYPES.map((value) => ({ label: value, value })),
    ...overrides,
  }) as Field

/**
 * Free-text questions the association asks a citizen after they reported an
 * action ("Comment s'est passé l'échange ?").
 *
 * The label is localized here because it is editorial content the association
 * authors and the citizen reads. Its counterpart on
 * `interpellation-submissions.feedback[].label` is deliberately NOT localized:
 * that one is a snapshot of the exact string the citizen saw.
 */
export const feedbackFieldsField: Field = {
  name: 'feedbackFields',
  type: 'array',
  labels: { singular: 'Feedback field', plural: 'Feedback fields' },
  admin: {
    description: 'Optional free-text questions shown on the "j\'ai interpellé" form.',
  },
  fields: [
    {
      name: 'label',
      type: 'text',
      localized: true,
      validate: requiredInDefaultLocale('A label is required.'),
    },
  ],
}
