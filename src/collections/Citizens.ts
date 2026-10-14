import type { CollectionConfig } from 'payload'

import { isAdmin, isAdminOrSelf } from '@/access'
import { citizenSessionStrategy, CITIZEN_SESSION_TTL_SECONDS } from '@/lib/citizenSession'
import { logoutCitizen } from '@/endpoints/citizenSession'
import { requestMagicLink, verifyMagicLinkRedirect } from '@/endpoints/magicLink'

/**
 * Public-site accounts. Separate from `users` (the admin panel login) so the two
 * sessions use different cookies and different access rules — a citizen row is
 * never one field flip away from admin access.
 *
 * `disableLocalStrategy` removes password auth entirely: sign-in is by magic link,
 * issued through the `magic-links` collection. Payload's own login/JWT machinery
 * can't establish a citizen session at all (`loginOperation` 403s the instant
 * `disableLocalStrategy` is set), and reusing its shared cookie would collide
 * with the admin panel's own session on this same origin — so `citizenSessionStrategy`
 * (`src/lib/citizenSession.ts`) is a fully custom `AuthStrategy` reading its own
 * `citizen-token` cookie, tried before Payload's shared `local-jwt` strategy and
 * falling through to it (harmlessly) whenever that cookie is absent.
 */
export const Citizens: CollectionConfig = {
  slug: 'citizens',
  labels: { singular: 'Citizen', plural: 'Citizens' },
  auth: {
    // `enableFields` keeps the unique `email` column, which is the citizen's
    // identity and the key the magic link is issued against; plain
    // `disableLocalStrategy: true` would remove it altogether.
    // `optionalPassword` leaves the password column nullable and unused.
    disableLocalStrategy: { enableFields: true, optionalPassword: true },
    // Already Payload's default — explicit because `citizenSessionStrategy`'s
    // revocation check depends on the `sessions` field this adds.
    useSessions: true,
    tokenExpiration: CITIZEN_SESSION_TTL_SECONDS,
    strategies: [citizenSessionStrategy],
  },
  endpoints: [requestMagicLink, verifyMagicLinkRedirect, logoutCitizen],
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'pseudo', 'emailVerified', 'createdAt'],
    group: 'Citizens',
  },
  access: {
    read: isAdminOrSelf,
    create: isAdmin,
    update: isAdminOrSelf,
    delete: isAdmin,
    // Citizens never reach the admin panel. (`admin` is boolean-only, so it
    // cannot reuse the query-returning `Access` helpers.)
    admin: () => false,
  },
  fields: [
    // `email` (unique) is provided by the auth collection.
    {
      name: 'pseudo',
      type: 'text',
      required: true,
      admin: { description: 'Display name. Publicly visible.' },
    },
    {
      name: 'emailVerified',
      type: 'checkbox',
      defaultValue: false,
      access: { update: () => false },
      admin: {
        readOnly: true,
        description: 'Set automatically when a magic link is clicked.',
      },
    },
  ],
}
