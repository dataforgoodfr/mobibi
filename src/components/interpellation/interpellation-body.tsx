import { Card } from '@/components/brand/card'
import { Display } from '@/components/brand/display'
import { RichText } from '@/components/brand/rich-text'
import { Timeline } from '@/components/interpellation/timeline'
import { TargetList } from '@/components/interpellation/target-list'
import type { CampaignDetail } from '@/lib/campaigns'
import type { CitizenIdentity } from '@/lib/citizenSession'
import type { Locale } from '@/lib/locale'
import type { CitizenSubmissions } from '@/lib/submissions'

/**
 * The interpellation-only part of the campaign page: timeline, contexte/demande,
 * target list. Kept out of `page.tsx` so the route stays a thin data-fetch +
 * branch, the same shape `PetitionBody` takes.
 */
export function InterpellationBody({
  campaign,
  citizen,
  lang,
  mine,
}: {
  campaign: Extract<CampaignDetail, { type: 'interpellation' }>
  citizen: CitizenIdentity | null
  lang: Locale
  mine: CitizenSubmissions
}) {
  return (
    <>
      <Timeline steps={campaign.timeline} />

      {(campaign.context || campaign.demand) && (
        <section className="mx-auto grid max-w-[var(--container-max)] gap-[var(--gap)] px-6 pt-6.5 sm:grid-cols-2">
          <Card className="p-[var(--pad)]">
            <Display as="h3" opsz={24} className="mb-2.5 text-2xl">
              Le contexte
            </Display>
            <RichText data={campaign.context} className="text-[0.97rem] text-ink-60" />
          </Card>
          <Card className="border-ink bg-ink p-[var(--pad)] text-paper">
            <Display as="h3" opsz={24} className="mb-2.5 text-2xl text-accent-2">
              Ce qu&apos;on demande
            </Display>
            <RichText data={campaign.demand} className="text-[0.97rem] opacity-92" />
          </Card>
        </section>
      )}

      <TargetList targets={campaign.targets} citizen={citizen} lang={lang} mine={mine} />
    </>
  )
}
