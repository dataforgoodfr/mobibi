import type { Payload, Where } from 'payload'

import type { CampaignStatus } from '@/fields/campaign'
import type { Locale } from '@/lib/locale'
import { mapOrganization, type OrganizationSummary } from '@/lib/organizations'
import { resolveTarget, type ResolvedTarget } from '@/lib/resolveTarget'
import { listRecentSignatures, type RecentSignature } from '@/lib/signatures'
import type { Interpellation, Media, Organization, Petition } from '@/payload-types'

export type CampaignOrganization = OrganizationSummary

export type CampaignTier = {
  threshold: number
  label: string
}

/**
 * An extra free-text question on the signing form. The index is the position
 * in `petitions.additionalFields` — what the signing form posts back, so the
 * server can snapshot the label itself rather than trust the client's copy
 * (see `endpoints/signPetition.ts`).
 */
export type CampaignAdditionalField = {
  index: number
  label: string
  required: boolean
}

type CampaignBase = {
  id: number
  slug: string
  status: CampaignStatus
  title: string
  tagline?: string
  photoUrl?: string
  startDate?: string
  endDate?: string
  organization: CampaignOrganization
  count: number
}

export type CampaignSummary =
  | (CampaignBase & { type: 'interpellation' })
  | (CampaignBase & { type: 'petition'; tiers: CampaignTier[]; nextTier?: CampaignTier })

export type TimelineStep = {
  label: string
  dateLabel?: string
  state: 'done' | 'current' | 'upcoming'
}

export type CampaignDetail =
  | (Extract<CampaignSummary, { type: 'interpellation' }> & {
      context?: Interpellation['context']
      demand?: Interpellation['demand']
      timeline: TimelineStep[]
      targets: ResolvedTarget[]
    })
  | (Extract<CampaignSummary, { type: 'petition' }> & {
      text?: Petition['text']
      recentSignatures: RecentSignature[]
      additionalFields: CampaignAdditionalField[]
    })

/**
 * The campaign-side analogue of `resolveTarget()` (`src/lib/resolveTarget.ts`):
 * the one place `interpellations` and `petitions` — two collections sharing one
 * URL space — are merged into a single shape components consume. Components
 * must not reach into the raw Payload documents directly.
 */
const resolveOrganization = (organization: number | Organization): CampaignOrganization => {
  if (typeof organization === 'number') {
    throw new Error('Organization must be populated (depth >= 1) to build a CampaignSummary.')
  }

  return mapOrganization(organization)
}

const resolvePhoto = (photo: number | Media | null | undefined): string | undefined =>
  photo && typeof photo === 'object' ? (photo.url ?? undefined) : undefined

const resolveInterpellation = (
  doc: Interpellation,
): Extract<CampaignSummary, { type: 'interpellation' }> => ({
  type: 'interpellation',
  id: doc.id,
  slug: doc.slug,
  status: doc.status,
  title: doc.title ?? '',
  tagline: doc.tagline ?? undefined,
  photoUrl: resolvePhoto(doc.photo),
  startDate: doc.startDate ?? undefined,
  endDate: doc.endDate ?? undefined,
  organization: resolveOrganization(doc.organization),
  count: doc.submissionCount ?? 0,
})

const resolvePetition = (doc: Petition): Extract<CampaignSummary, { type: 'petition' }> => {
  const tiers: CampaignTier[] = (doc.tiers ?? [])
    .filter((tier): tier is { threshold: number; label: string; id?: string | null } =>
      Boolean(tier.label),
    )
    .map((tier) => ({ threshold: tier.threshold, label: tier.label as string }))
    .sort((a, b) => a.threshold - b.threshold)

  const count = doc.signatureCount ?? 0
  const nextTier = tiers.find((tier) => tier.threshold > count) ?? tiers[tiers.length - 1]

  return {
    type: 'petition',
    id: doc.id,
    slug: doc.slug,
    status: doc.status,
    title: doc.title ?? '',
    tagline: doc.tagline ?? undefined,
    photoUrl: resolvePhoto(doc.photo),
    startDate: doc.startDate ?? undefined,
    endDate: doc.endDate ?? undefined,
    organization: resolveOrganization(doc.organization),
    count,
    tiers,
    nextTier,
  }
}

/**
 * The public URL of a campaign, in one place. Both the components that link to
 * one (`home/campaign-card.tsx`) and the server code that redirects to one
 * (`performIntent`, in `src/lib/magicLink.ts`) build it here rather than
 * re-stating the route shape — `/:lang/:organization/:slug` is a fact about
 * the routing, and the two campaign collections share it.
 */
export const campaignPath = (lang: Locale, organizationSlug: string, slug: string): string =>
  `/${lang}/${organizationSlug}/${slug}`

/**
 * Detail-only, so it lives here rather than in `resolvePetition`. The index
 * kept is the position in the RAW array, not in the filtered result: it is
 * what the signing form posts back and what `buildResponses`
 * (`endpoints/signPetition.ts`) looks the label up by. The two must agree on
 * that — do not switch either to the filtered position.
 */
const resolveAdditionalFields = (doc: Petition): CampaignAdditionalField[] =>
  (doc.additionalFields ?? []).flatMap((field, index) =>
    field.label ? [{ index, label: field.label, required: Boolean(field.required) }] : [],
  )

/**
 * Every active or upcoming campaign, across both collections, for the home
 * page list — or, when `organizationSlug` is passed, scoped to one
 * organization for its page.
 *
 * `limit: 100` and doing the totals in JS (see `campaignTotals`) are honest
 * ceilings for V0's seeded data, not a real aggregate — revisit once campaign
 * counts grow past what one page can hold.
 */
export const listActiveCampaigns = async (
  payload: Payload,
  locale: Locale,
  organizationSlug?: string,
): Promise<CampaignSummary[]> => {
  const where: Where = {
    status: { in: ['active', 'upcoming'] as CampaignStatus[] },
    ...(organizationSlug ? { 'organization.slug': { equals: organizationSlug } } : {}),
  }

  const [interpellations, petitions] = await Promise.all([
    payload.find({
      collection: 'interpellations',
      where,
      depth: 1,
      limit: 100,
      sort: '-createdAt',
      locale,
    }),
    payload.find({
      collection: 'petitions',
      where,
      depth: 1,
      limit: 100,
      sort: '-createdAt',
      locale,
    }),
  ])

  // Each collection is already sorted by recency; IDs are not comparable
  // across collections, so the two lists are concatenated rather than
  // re-sorted globally. Revisit if the home page needs one true chronological
  // order across both.
  return [
    ...interpellations.docs.map(resolveInterpellation),
    ...petitions.docs.map(resolvePetition),
  ]
}

/**
 * The single campaign at `/:organization/:slug`, resolved across both
 * collections. `validateUniqueCampaignSlug` guarantees a slug is unique
 * across both collections for a given organization, so at most one of the
 * two queries below can ever match — querying both in parallel and
 * preferring the petition arm is arbitrary but safe.
 */
export const getCampaign = async (
  payload: Payload,
  { organization, slug, locale }: { organization: string; slug: string; locale: Locale },
): Promise<CampaignDetail | null> => {
  const where: Where = {
    and: [
      { slug: { equals: slug } },
      { 'organization.slug': { equals: organization } },
      // The local API defaults to overrideAccess: true, so the access rule
      // `publishedCampaignOrAdmin` does NOT apply here — filter drafts by hand.
      { status: { not_equals: 'draft' } },
    ],
  }

  const [interpellations, petitions] = await Promise.all([
    payload.find({ collection: 'interpellations', where, depth: 1, limit: 1, locale }),
    payload.find({ collection: 'petitions', where, depth: 1, limit: 1, locale }),
  ])

  const petition = petitions.docs[0]
  if (petition) {
    return {
      ...resolvePetition(petition),
      text: petition.text ?? undefined,
      recentSignatures: await listRecentSignatures(payload, petition.id, 8),
      additionalFields: resolveAdditionalFields(petition),
    }
  }

  const doc = interpellations.docs[0]
  if (!doc) return null

  // Sorted least-solicited first — the list's default order, and the reason
  // `campaign-targets.submissionCount` is indexed. `limit: 500` is an honest
  // ceiling for V0's seeded data, matching `listActiveCampaigns`'s `limit: 100`.
  const { docs: targets } = await payload.find({
    collection: 'campaign-targets',
    where: { campaign: { equals: doc.id } },
    sort: 'submissionCount',
    depth: 0,
    limit: 500,
    locale,
  })

  return {
    ...resolveInterpellation(doc),
    context: doc.context ?? undefined,
    demand: doc.demand ?? undefined,
    timeline: (doc.timeline ?? [])
      .filter((step) => Boolean(step.label))
      .map((step) => ({
        label: step.label as string,
        dateLabel: step.dateLabel ?? undefined,
        state: step.state,
      })),
    targets: targets.map((target) => resolveTarget(target, doc)),
  }
}

/** Sums for the home hero's two stat cards. */
export const campaignTotals = (
  campaigns: CampaignSummary[],
): { interpellations: number; signatures: number } =>
  campaigns.reduce(
    (totals, campaign) => {
      if (campaign.type === 'interpellation') totals.interpellations += campaign.count
      else totals.signatures += campaign.count
      return totals
    },
    { interpellations: 0, signatures: 0 },
  )
