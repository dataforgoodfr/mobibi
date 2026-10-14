import type { CollectionConfig } from 'payload'

/**
 * Platform administrators — the admin-panel login (password auth).
 *
 * Distinct from `citizens`, the public-site accounts, so the two sessions use
 * different cookies and different access rules.
 */
export const Admins: CollectionConfig = {
  slug: 'admins',
  admin: {
    useAsTitle: 'email',
  },
  auth: true,
  fields: [
    // Email added by default
    // Add more fields as needed
  ],
}
