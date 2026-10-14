import type { CollectionConfig } from 'payload'

import { nobody } from '@/access'

/**
 * A pending magic link, and the action it will perform once clicked.
 *
 * The intent has to be persisted rather than replayed client-side because the spec
 * forbids optimistic counters: an unauthenticated citizen fills in the
 * « j'ai interpellé » form or the signing form BEFORE having an account, and the
 * submission/signature may only be written after the link is confirmed.
 *
 * Fully server-side: no role can read or write it through the API.
 */
export const MagicLinks: CollectionConfig = {
  slug: 'magic-links',
  labels: { singular: 'Magic link', plural: 'Magic links' },
  admin: {
    useAsTitle: 'email',
    hidden: true,
    group: 'Citizens',
  },
  access: {
    read: nobody,
    create: nobody,
    update: nobody,
    delete: nobody,
  },
  fields: [
    {
      name: 'email',
      type: 'email',
      required: true,
      index: true,
    },
    {
      // Only the hash is stored — a leaked table must not grant anyone a session.
      name: 'tokenHash',
      type: 'text',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'expiresAt',
      type: 'date',
      required: true,
    },
    {
      name: 'usedAt',
      type: 'date',
      admin: { description: 'Set on redemption; a link is single-use.' },
    },
    {
      name: 'intent',
      type: 'group',
      fields: [
        {
          name: 'type',
          type: 'select',
          required: true,
          defaultValue: 'login',
          options: [
            { label: 'login', value: 'login' },
            { label: 'interpellation-submission', value: 'interpellation-submission' },
            { label: 'petition-signature', value: 'petition-signature' },
          ],
        },
        {
          name: 'payload',
          type: 'json',
          admin: {
            description: 'The pending submission or signature, written once the link is confirmed.',
          },
        },
      ],
    },
  ],
}
