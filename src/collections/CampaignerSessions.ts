import type { CollectionConfig } from 'payload'

import { nobody } from '@/access'

export const CampaignerSessions: CollectionConfig = {
  slug: 'campaigner-sessions',
  labels: { singular: 'Campaigner session', plural: 'Campaigner sessions' },
  admin: {
    hidden: true,
    group: 'Campaigners',
  },
  access: {
    read: nobody,
    create: nobody,
    update: nobody,
    delete: nobody,
  },
  fields: [
    {
      name: 'campaigner',
      type: 'relationship',
      relationTo: 'campaigners',
      required: true,
      index: true,
    },
    {
      name: 'expiresAt',
      type: 'date',
      required: true,
      admin: { date: { pickerAppearance: 'dayAndTime' } },
    },
    {
      name: 'oidcSid',
      type: 'text',
      index: true,
      admin: {
        description: 'Session id from the identity provider, used for back-channel logout.',
      },
    },
    {
      name: 'idToken',
      type: 'text',
      admin: { description: 'Kept as the hint for RP-initiated logout.' },
    },
    {
      name: 'refreshToken',
      type: 'text',
    },
    {
      name: 'accessTokenExpiresAt',
      type: 'date',
      admin: { date: { pickerAppearance: 'dayAndTime' } },
    },
  ],
}
