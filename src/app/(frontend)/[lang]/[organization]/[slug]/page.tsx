import { headers } from 'next/headers'
import { getPayload } from 'payload'
import { notFound } from 'next/navigation'
import { cache } from 'react'

import { CampaignHeader } from '@/components/campaign/campaign-header'
import { InterpellationBody } from '@/components/interpellation/interpellation-body'
import { PetitionBody } from '@/components/petition/petition-body'
import type { SigningState } from '@/components/petition/sign-modal'
import { getCampaign } from '@/lib/campaigns'
import { getCitizen, toCitizenIdentity, type CitizenIdentity } from '@/lib/citizenSession'
import type { Locale } from '@/lib/locale'
import { hasSigned } from '@/lib/signatures'
import { EMPTY_SUBMISSIONS, getCitizenSubmissions } from '@/lib/submissions'
import config from '@payload-config'

// The page and `generateMetadata` both need the campaign; `cache()` makes
// Next dedupe the two calls into one Payload query per request instead of two.
const loadCampaign = cache(async (organization: string, slug: string, lang: Locale) => {
  const payload = await getPayload({ config })
  return getCampaign(payload, { organization, slug, locale: lang })
})

/**
 * Who the visitor is. Both write flows need it — the signing modal and the
 * interpeller modal each prefill from the account rather than asking again.
 * Server-side on purpose: it has to survive a reload and a magic-link
 * navigation, neither of which any state a modal holds would.
 */
export default async function CampaignPage({
  params,
}: {
  params: Promise<{ lang: Locale; organization: string; slug: string }>
}) {
  const { lang, organization, slug } = await params
  const campaign = await loadCampaign(organization, slug, lang)
  if (!campaign) notFound()

  const payload = await getPayload({ config })
  const citizen = await getCitizen(payload, await headers())
  const identity: CitizenIdentity | null = citizen ? toCitizenIdentity(citizen) : null

  const signing: SigningState = {
    citizen: identity,
    hasSigned:
      campaign.type === 'petition' && citizen
        ? await hasSigned(payload, campaign.id, citizen.id)
        : false,
  }

  // Each type pays for its own extra query, and only for a signed-in visitor:
  // « as-tu déjà signé » for a petition, « qui as-tu déjà interpellé » here.
  // Unlike the petition's yes/no, this one is per target and can be > 1 —
  // repeat submissions are legal by design.
  const mine =
    campaign.type === 'interpellation' && citizen
      ? await getCitizenSubmissions(payload, campaign.id, citizen.id)
      : EMPTY_SUBMISSIONS

  return (
    <div>
      <CampaignHeader campaign={campaign} lang={lang} signing={signing} mine={mine} />

      {campaign.type === 'interpellation' && (
        <InterpellationBody campaign={campaign} citizen={identity} lang={lang} mine={mine} />
      )}
      {campaign.type === 'petition' && (
        <PetitionBody campaign={campaign} lang={lang} signing={signing} />
      )}
    </div>
  )
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: Locale; organization: string; slug: string }>
}) {
  const { lang, organization, slug } = await params
  const campaign = await loadCampaign(organization, slug, lang)
  if (!campaign) return {}

  return { title: campaign.title }
}
