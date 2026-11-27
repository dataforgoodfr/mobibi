import { ValidationError, type CollectionConfig } from 'payload'

import { isAdmin } from '@/access'
import { campaignerEndpoints } from '@/endpoints/campaigners'

export const Campaigners: CollectionConfig = {
  slug: 'campaigners',
  labels: { singular: 'Campaigner', plural: 'Campaigners' },
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'name', 'lastLoginAt'],
    group: 'Campaigners',
  },
  access: {
    read: isAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  endpoints: campaignerEndpoints(),
  // Not unique: the hook enforces uniqueness only once both are set.
  indexes: [{ fields: ['oidcIssuer', 'oidcSubject'] }],
  hooks: {
    beforeValidate: [
      async ({ data, originalDoc, req }) => {
        if (!data) return data
        if (typeof data.email === 'string') data.email = data.email.trim().toLowerCase()

        const issuer = data.oidcIssuer ?? originalDoc?.oidcIssuer
        const subject = data.oidcSubject ?? originalDoc?.oidcSubject
        if (!issuer || !subject) return data

        const existing = await req.payload.find({
          collection: 'campaigners',
          where: {
            and: [
              { oidcIssuer: { equals: issuer } },
              { oidcSubject: { equals: subject } },
              ...(originalDoc?.id ? [{ id: { not_equals: originalDoc.id } }] : []),
            ],
          },
          limit: 1,
          depth: 0,
          pagination: false,
          req,
        })
        if (existing.docs.length > 0) {
          throw new ValidationError({
            collection: 'campaigners',
            errors: [
              {
                path: 'oidcSubject',
                message: 'This OIDC identity is already linked to a campaigner.',
              },
            ],
            req,
          })
        }
        return data
      },
    ],
    // The only cleanup path for sessions: the FK is ON DELETE SET NULL on a NOT NULL column,
    // so a delete that bypasses this hook fails instead of orphaning rows.
    beforeDelete: [
      async ({ id, req }) => {
        await req.payload.delete({
          collection: 'campaigner-sessions',
          where: { campaigner: { equals: id } },
          req,
        })
      },
    ],
  },
  fields: [
    {
      name: 'email',
      type: 'email',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'name',
      type: 'text',
    },
    {
      name: 'oidcIssuer',
      type: 'text',
      admin: {
        description: 'Set on first OIDC login; the identity provider that vouched for this person.',
      },
    },
    {
      name: 'oidcSubject',
      type: 'text',
      admin: {
        description: 'Set on first OIDC login; the stable user id at the identity provider.',
      },
    },
    {
      name: 'lastLoginAt',
      type: 'date',
      admin: { date: { pickerAppearance: 'dayAndTime' }, readOnly: true },
    },
  ],
}
