import type { Field } from 'payload'

import { slugField } from './slug'
import { requiredInDefaultLocale } from './validation'

export const CAMPAIGN_STATUSES = ['draft', 'upcoming', 'active', 'archived'] as const

export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number]

/**
 * Fields shared by `interpellations` and `petitions`.
 *
 * The two campaign types are separate collections, but both are addressed by the
 * same public route `/:organization/:slug`, so their identity fields must line up.
 */
export const campaignBaseFields = (): Field[] => [
  {
    name: 'organization',
    type: 'relationship',
    relationTo: 'organizations',
    required: true,
    index: true,
    admin: { position: 'sidebar' },
  },
  slugField('title'),
  {
    name: 'status',
    type: 'select',
    required: true,
    defaultValue: 'draft',
    index: true,
    options: CAMPAIGN_STATUSES.map((value) => ({ label: value, value })),
    admin: {
      position: 'sidebar',
      description: 'Drafts are hidden from the public site.',
    },
  },
  {
    name: 'startDate',
    type: 'date',
    admin: { position: 'sidebar' },
  },
  {
    name: 'endDate',
    type: 'date',
    admin: { position: 'sidebar' },
  },
  {
    name: 'title',
    type: 'text',
    localized: true,
    // Mandatory in French, optional in the other locales — see the helper.
    validate: requiredInDefaultLocale('A title is required.'),
  },
  {
    name: 'tagline',
    type: 'textarea',
    localized: true,
    admin: { description: 'Short hook shown on cards and under the campaign title.' },
  },
  {
    name: 'photo',
    type: 'upload',
    relationTo: 'media',
  },
]
