import type { Access, FieldAccess, PayloadRequest } from 'payload'

/**
 * The project has two auth collections:
 * - `admins`   → admin panel (password login)
 * - `citizens` → public site (magic link only)
 *
 * `req.user.collection` is the only reliable way to tell them apart.
 */
export const isAdminUser = (user: PayloadRequest['user']): boolean =>
  Boolean(user && user.collection === 'admins')

export const isCitizenUser = (user: PayloadRequest['user']): boolean =>
  Boolean(user && user.collection === 'citizens')

export const anyone: Access = () => true

export const nobody: Access = () => false

export const isAdmin: Access = ({ req }) => isAdminUser(req.user)

export const isAdminFieldLevel: FieldAccess = ({ req }) => isAdminUser(req.user)

export const isCitizen: Access = ({ req }) => isCitizenUser(req.user)

/** Admins see everything; the public only sees campaigns that are not drafts. */
export const publishedCampaignOrAdmin: Access = ({ req }) => {
  if (isAdminUser(req.user)) return true
  return { status: { not_equals: 'draft' } }
}

/**
 * Same rule, one relationship hop away — used by `campaign-targets`, whose
 * visibility follows the campaign it belongs to.
 */
export const publishedCampaignOrAdminViaCampaign: Access = ({ req }) => {
  if (isAdminUser(req.user)) return true
  return { 'campaign.status': { not_equals: 'draft' } }
}

/** A citizen may only read/update their own record. */
export const isAdminOrSelf: Access = ({ req }) => {
  if (isAdminUser(req.user)) return true
  if (isCitizenUser(req.user)) return { id: { equals: req.user!.id } }
  return false
}
