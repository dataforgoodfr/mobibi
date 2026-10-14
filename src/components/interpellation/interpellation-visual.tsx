import Image from 'next/image'

import { Card } from '@/components/brand/card'
import { ImageSlot } from '@/components/brand/image-slot'
import type { CampaignDetail } from '@/lib/campaigns'
import { formatCount } from '@/lib/format'
import type { Locale } from '@/lib/locale'
import type { CitizenSubmissions } from '@/lib/submissions'

/**
 * `CampaignHeader`'s right column for an interpellation: the campaign photo
 * (or `ImageSlot` fallback) with a floating stat card. Split out to mirror
 * `CounterCard`, the petition header's equivalent right column.
 */
export function InterpellationVisual({
  campaign,
  lang,
  mine,
}: {
  campaign: Extract<CampaignDetail, { type: 'interpellation' }>
  lang: Locale
  mine: CitizenSubmissions
}) {
  return (
    <div className="relative">
      {campaign.photoUrl ? (
        <Image
          src={campaign.photoUrl}
          alt=""
          width={800}
          height={600}
          priority
          className="aspect-[4/3] w-full rounded-[var(--radius)] border-[length:var(--bd-w)] border-ink object-cover"
        />
      ) : (
        <ImageSlot label="Photo à venir" ratio="4/3" />
      )}
      <Card className="absolute -bottom-5.5 left-4.5 rotate-[-3deg] px-4.5 py-3">
        <div className="font-display text-[2.1rem] leading-none font-extrabold text-accent">
          {formatCount(campaign.count, lang)}
        </div>
        <div className="text-[0.78rem] font-bold text-ink-60">
          interpellations · {formatCount(campaign.targets.length, lang)} cibles
        </div>
        {/* The citizen's own share of that total. Inside the already-floating
            card, so it shifts nothing on the page — and absent entirely for a
            visitor who hasn't acted, rather than showing a demoralising 0. */}
        {mine.total > 0 && (
          <div
            data-testid="my-submission-count"
            className="mt-1.5 border-t-[length:var(--bd-w)] border-ink pt-1.5 text-[0.78rem] font-extrabold text-ink"
          >
            ✊ dont {formatCount(mine.total, lang)} de toi
          </div>
        )}
      </Card>
    </div>
  )
}
