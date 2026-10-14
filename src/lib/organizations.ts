import type { Payload } from 'payload'

import type { Locale } from '@/lib/locale'
import type { Media, Organization } from '@/payload-types'

export type OrganizationSummary = {
  name: string
  slug: string
  shortName?: string
  color?: string
  logoUrl?: string
  description?: string
}

type OrganizationDoc = Pick<
  Organization,
  'name' | 'slug' | 'shortName' | 'color' | 'logo' | 'description'
>

/**
 * Shared by `getOrganization()` below and `campaigns.ts`'s `resolveOrganization()`
 * — the one place an `organizations` document (however it was fetched, full
 * or `select`-narrowed) is turned into what components consume.
 */
export const mapOrganization = (doc: OrganizationDoc): OrganizationSummary => {
  const logo = doc.logo as number | Media | null | undefined

  return {
    name: doc.name,
    slug: doc.slug,
    shortName: doc.shortName ?? undefined,
    color: doc.color ?? undefined,
    logoUrl: logo && typeof logo === 'object' ? (logo.url ?? undefined) : undefined,
    description: doc.description ?? undefined,
  }
}

/**
 * The organization-side analogue of `resolveTarget()` / `getCampaign()`: the
 * one place an `organizations` document is fetched by slug for a page that
 * only needs the organization itself, not its campaigns.
 *
 * `select` keeps the `interpellations`/`petitions` join fields out of the
 * response — `depth: 1` alone would populate them (every campaign the org
 * runs) purely so they can be discarded, the same cost `campaigns.ts` pays
 * on purpose because it needs the joins the other way around. `depth: 1` is
 * still needed for `logo`, the one relationship this read path does use.
 */
export const getOrganization = async (
  payload: Payload,
  { slug, locale }: { slug: string; locale: Locale },
): Promise<OrganizationSummary | null> => {
  const { docs } = await payload.find({
    collection: 'organizations',
    where: { slug: { equals: slug } },
    select: { name: true, slug: true, shortName: true, color: true, logo: true, description: true },
    depth: 1,
    limit: 1,
    locale,
  })

  const doc = docs[0]
  return doc ? mapOrganization(doc) : null
}
