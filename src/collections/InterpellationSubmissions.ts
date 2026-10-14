import type { CollectionConfig } from 'payload'

import { isAdmin, isCitizen, nobody } from '@/access'
import { decrementInterpellationCounters, incrementInterpellationCounters } from '@/hooks/counters'

/**
 * One declared action: "j'ai interpellé X on channel Y".
 *
 * No unique constraint — the spec explicitly allows repeated submissions for the
 * same (citizen, target, channel), and the displayed counter is a count of
 * submissions, not of distinct citizens.
 */
export const InterpellationSubmissions: CollectionConfig = {
  slug: 'interpellation-submissions',
  labels: { singular: 'Interpellation submission', plural: 'Interpellation submissions' },
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['citizen', 'target', 'channelType', 'createdAt'],
    group: 'Citizens',
  },
  access: {
    // Never public: the rows carry citizen identities and free-text feedback.
    read: isAdmin,
    create: isCitizen,
    update: nobody,
    delete: isAdmin,
  },
  hooks: {
    afterChange: [incrementInterpellationCounters],
    afterDelete: [decrementInterpellationCounters],
  },
  fields: [
    {
      name: 'citizen',
      type: 'relationship',
      relationTo: 'citizens',
      required: true,
      index: true,
    },
    {
      name: 'target',
      type: 'relationship',
      relationTo: 'campaign-targets',
      required: true,
      index: true,
    },
    {
      // Denormalised so campaign totals and exports need no join through target.
      name: 'campaign',
      type: 'relationship',
      relationTo: 'interpellations',
      required: true,
      index: true,
    },
    {
      name: 'channelId',
      type: 'text',
      required: true,
      admin: { description: "Id of the row in the target's channels[] array." },
    },
    {
      // Snapshot: the association may edit or remove the channel afterwards, and
      // the historical record must still say how the citizen made contact.
      name: 'channelType',
      type: 'text',
      required: true,
    },
    {
      name: 'feedback',
      type: 'array',
      labels: { singular: 'Answer', plural: 'Feedback' },
      fields: [
        {
          // NOT localized, unlike the campaign-side `feedbackFields[].label` this
          // copies. It records the exact string this citizen saw, in the locale
          // they were browsing — localizing it would reintroduce exactly the drift
          // the snapshot exists to prevent.
          name: 'label',
          type: 'text',
          required: true,
        },
        {
          name: 'value',
          type: 'textarea',
        },
      ],
    },
  ],
}
