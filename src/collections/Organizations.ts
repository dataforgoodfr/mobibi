import type { CollectionConfig } from 'payload'

import { anyone, isAdmin } from '@/access'
import { slugField } from '@/fields/slug'

export const Organizations: CollectionConfig = {
  slug: 'organizations',
  labels: { singular: 'Organization', plural: 'Organizations' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'updatedAt'],
    group: 'Mobilisations',
  },
  access: {
    read: anyone,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    { ...slugField('name'), unique: true },
    {
      name: 'shortName',
      type: 'text',
      maxLength: 4,
      admin: {
        position: 'sidebar',
        description: 'Initials used for the avatar when no logo is set (e.g. "TV").',
      },
    },
    {
      name: 'color',
      type: 'text',
      admin: {
        position: 'sidebar',
        description: 'Brand colour, hex (e.g. #0f7a5a).',
      },
      validate: (value: string | null | undefined) =>
        !value || /^#[0-9a-fA-F]{6}$/.test(value) || 'Must be a hex colour such as #0f7a5a',
    },
    {
      name: 'logo',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'description',
      type: 'textarea',
      localized: true,
    },
    {
      name: 'interpellations',
      type: 'join',
      collection: 'interpellations',
      on: 'organization',
      admin: { defaultColumns: ['title', 'status', 'submissionCount'] },
    },
    {
      name: 'petitions',
      type: 'join',
      collection: 'petitions',
      on: 'organization',
      admin: { defaultColumns: ['title', 'status', 'signatureCount'] },
    },
  ],
}
