import { getPayload } from 'payload'
import { notFound } from 'next/navigation'
import { cache } from 'react'

import { CampaignList } from '@/components/home/campaign-list'
import { OrganizationHeader } from '@/components/organization/organization-header'
import { listActiveCampaigns } from '@/lib/campaigns'
import { getOrganization } from '@/lib/organizations'
import type { Locale } from '@/lib/locale'
import config from '@payload-config'

// Forces per-request rendering instead of a build-time static export: the
// campaign counters shown here are live (see counters.ts), so a page frozen
// at build time would serve stale counts until the next deploy — and
// building would require a reachable database in the first place.
export const dynamic = 'force-dynamic'

// The page and `generateMetadata` both need the organization; `cache()`
// makes Next dedupe the two calls into one Payload query per request.
const loadOrganization = cache(async (slug: string, lang: Locale) => {
  const payload = await getPayload({ config })
  return getOrganization(payload, { slug, locale: lang })
})

export default async function OrganizationPage({
  params,
}: {
  params: Promise<{ lang: Locale; organization: string }>
}) {
  const { lang, organization: slug } = await params
  const organization = await loadOrganization(slug, lang)
  if (!organization) notFound()

  const payload = await getPayload({ config })
  const campaigns = await listActiveCampaigns(payload, lang, slug)

  return (
    <div>
      <OrganizationHeader organization={organization} />
      <CampaignList campaigns={campaigns} lang={lang} />
    </div>
  )
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: Locale; organization: string }>
}) {
  const { lang, organization: slug } = await params
  const organization = await loadOrganization(slug, lang)
  if (!organization) return {}

  return { title: organization.name }
}
