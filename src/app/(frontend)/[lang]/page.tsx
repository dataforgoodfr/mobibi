import { getPayload } from 'payload'

import { CampaignList } from '@/components/home/campaign-list'
import { Hero } from '@/components/home/hero'
import { Marquee } from '@/components/home/marquee'
import { campaignTotals, listActiveCampaigns } from '@/lib/campaigns'
import type { Locale } from '@/lib/locale'
import config from '@payload-config'

// No `title` here: the layout's `default` is already this exact copy — see
// `[lang]/layout.tsx`. Future routes set their own short `title` instead.

// Forces per-request rendering instead of a build-time static export: the
// counters shown here are live (see counters.ts), so a page frozen at build
// time would serve stale counts until the next deploy — and building would
// require a reachable database in the first place.
export const dynamic = 'force-dynamic'

export default async function HomePage({ params }: { params: Promise<{ lang: Locale }> }) {
  const { lang } = await params
  const payload = await getPayload({ config })
  const campaigns = await listActiveCampaigns(payload, lang)
  const totals = campaignTotals(campaigns)

  return (
    <>
      <Hero
        interpellationCount={totals.interpellations}
        signatureCount={totals.signatures}
        lang={lang}
      />
      <Marquee />
      <CampaignList campaigns={campaigns} lang={lang} />
    </>
  )
}
