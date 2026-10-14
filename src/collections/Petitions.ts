import type { CollectionConfig } from 'payload'

import { isAdmin, publishedCampaignOrAdmin } from '@/access'
import { recentSignatures } from '@/endpoints/recentSignatures'
import { signPetition } from '@/endpoints/signPetition'
import { campaignBaseFields } from '@/fields/campaign'
import { requiredInDefaultLocale } from '@/fields/validation'
import { validateUniqueCampaignSlug } from '@/hooks/validateUniqueCampaignSlug'

export const Petitions: CollectionConfig = {
  slug: 'petitions',
  labels: { singular: 'Petition', plural: 'Petitions' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'organization', 'status', 'signatureCount'],
    group: 'Mobilisations',
  },
  access: {
    read: publishedCampaignOrAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: {
    beforeValidate: [validateUniqueCampaignSlug('petitions')],
  },
  endpoints: [recentSignatures, signPetition],
  fields: [
    ...campaignBaseFields(),
    {
      name: 'text',
      type: 'richText',
      localized: true,
      admin: { description: "« Le texte qu'on signe »." },
    },
    {
      name: 'tiers',
      type: 'array',
      labels: { singular: 'Tier', plural: 'Tiers' },
      admin: { description: 'Paliers — thresholds the progress bar aims at, in ascending order.' },
      fields: [
        {
          name: 'threshold',
          type: 'number',
          required: true,
          min: 1,
        },
        {
          name: 'label',
          type: 'text',
          localized: true,
          validate: requiredInDefaultLocale('A label is required.'),
        },
      ],
    },
    {
      name: 'additionalFields',
      type: 'array',
      labels: { singular: 'Additional field', plural: 'Additional fields' },
      admin: {
        description: 'Extra free-text fields on the signing form (e.g. « Code postal »).',
      },
      fields: [
        {
          // Localized: editorial text the association authors. The snapshot on
          // `petition-signatures.responses[].label` is not.
          name: 'label',
          type: 'text',
          localized: true,
          validate: requiredInDefaultLocale('A label is required.'),
        },
        {
          name: 'required',
          type: 'checkbox',
          defaultValue: false,
        },
      ],
    },
    {
      name: 'signatureCount',
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
      name: 'signatures',
      type: 'join',
      collection: 'petition-signatures',
      on: 'petition',
      admin: { defaultColumns: ['citizen', 'city', 'createdAt'] },
    },
  ],
}
