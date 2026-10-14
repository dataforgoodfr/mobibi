'use client'

import { useState } from 'react'

import { CampaignCard } from '@/components/home/campaign-card'
import { Display } from '@/components/brand/display'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { CampaignSummary } from '@/lib/campaigns'
import type { Locale } from '@/lib/locale'

type Filter = 'all' | 'interpellation' | 'petition'

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Tout' },
  { value: 'interpellation', label: 'Interpeller' },
  { value: 'petition', label: 'Pétitions' },
]

export function CampaignList({ campaigns, lang }: { campaigns: CampaignSummary[]; lang: Locale }) {
  const [filter, setFilter] = useState<Filter>('all')

  const filtered = campaigns.filter((c) => filter === 'all' || c.type === filter)

  return (
    <section
      id="liste-mob"
      className="mx-auto max-w-[var(--container-max)] px-6 pt-[var(--section-y)] [scroll-margin-top:70px]"
    >
      <div className="mb-6.5 flex flex-wrap items-end justify-between gap-5">
        <Display as="h2" opsz={40} className="text-[2.5rem]">
          Mobilisations en cours
        </Display>
        <ToggleGroup
          value={[filter]}
          onValueChange={(values) => {
            // `multiple` is false, so at most one value ever comes back; an
            // empty array means the pressed item was clicked again — keep the
            // current filter rather than letting the segmented control go blank.
            const [next] = values
            if (next) setFilter(next as Filter)
          }}
        >
          {FILTERS.map(({ value, label }) => (
            <ToggleGroupItem key={value} value={value}>
              {label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {filtered.length === 0 ? (
        <p className="py-16 text-center font-bold text-ink-60">
          Aucune mobilisation pour le moment.
        </p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(330px,1fr))] gap-[var(--gap)]">
          {filtered.map((campaign) => (
            <CampaignCard key={`${campaign.type}-${campaign.id}`} campaign={campaign} lang={lang} />
          ))}
        </div>
      )}
    </section>
  )
}
