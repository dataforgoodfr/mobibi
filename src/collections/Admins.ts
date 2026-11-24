import type { CollectionConfig } from 'payload'

import { isAdmin } from '@/access'

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
  access: {
    read: isAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
    unlock: isAdmin,
  },
  auth: true,
  fields: [
    // Email added by default
    // Add more fields as needed
  ],
}
