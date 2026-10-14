import type { CollectionConfig } from 'payload'

import { isAdmin, publishedCampaignOrAdmin } from '@/access'
import { campaignBaseFields } from '@/fields/campaign'
import { channelTypeField } from '@/fields/channels'
import { requiredInDefaultLocale } from '@/fields/validation'
import { validateUniqueCampaignSlug } from '@/hooks/validateUniqueCampaignSlug'

export const Interpellations: CollectionConfig = {
  slug: 'interpellations',
  labels: { singular: 'Interpellation', plural: 'Interpellations' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'organization', 'status', 'submissionCount'],
    group: 'Mobilisations',
  },
  access: {
    read: publishedCampaignOrAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: {
    beforeValidate: [validateUniqueCampaignSlug('interpellations')],
  },
  fields: [
    ...campaignBaseFields(),
    {
      name: 'context',
      type: 'richText',
      localized: true,
      admin: { description: '« Le contexte » block.' },
    },
    {
      name: 'demand',
      type: 'richText',
      localized: true,
      admin: { description: "« Ce qu'on demande » block." },
    },
    {
      name: 'timeline',
      type: 'array',
      labels: { singular: 'Step', plural: 'Timeline' },
      admin: { description: '« Où en est le combat » — ordered steps.' },
      fields: [
        {
          name: 'label',
          type: 'text',
          localized: true,
          validate: requiredInDefaultLocale('A label is required.'),
        },
        {
          // Free text, not a date field: the design shows ranges such as
          // « Avr.–juin 2026 » that no date formatter would produce.
          name: 'dateLabel',
          type: 'text',
          localized: true,
        },
        {
          name: 'state',
          type: 'select',
          required: true,
          defaultValue: 'upcoming',
          options: [
            { label: 'done', value: 'done' },
            { label: 'current', value: 'current' },
            { label: 'upcoming', value: 'upcoming' },
          ],
        },
      ],
    },
    {
      name: 'defaultMessages',
      type: 'array',
      labels: { singular: 'Default message', plural: 'Default messages' },
      admin: {
        description:
          'Campaign-wide pre-written message per channel. A target may override it on its own channel.',
      },
      fields: [
        channelTypeField({ name: 'channelType' }),
        {
          name: 'subject',
          type: 'text',
          localized: true,
          admin: {
            description: 'Email only.',
            condition: (_, siblingData) => siblingData?.channelType === 'email',
          },
        },
        {
          name: 'body',
          type: 'textarea',
          localized: true,
          validate: requiredInDefaultLocale('A message body is required.'),
          admin: {
            description: 'Supports the {handle} and {lastName} placeholders.',
          },
        },
      ],
    },
    {
      name: 'submissionCount',
      type: 'number',
      defaultValue: 0,
      index: true,
      access: { update: () => false },
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Maintained automatically.',
      },
    },
    {
      name: 'targets',
      type: 'join',
      collection: 'campaign-targets',
      on: 'campaign',
      admin: {
        defaultColumns: ['fullName', 'role', 'district', 'submissionCount'],
      },
    },
  ],
}
