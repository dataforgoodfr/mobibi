import Link from 'next/link'

import { InitialsAvatar } from '@/components/brand/avatar'
import { Display } from '@/components/brand/display'
import { Pill } from '@/components/brand/pill'
import { StatusBadge } from '@/components/brand/status-badge'
import { Sticker } from '@/components/brand/sticker'
import { InterpellationVisual } from '@/components/interpellation/interpellation-visual'
import { CounterCard } from '@/components/petition/counter-card'
import type { SigningState } from '@/components/petition/sign-modal'
import type { CampaignDetail } from '@/lib/campaigns'
import { formatDate } from '@/lib/format'
import type { Locale } from '@/lib/locale'
import type { CitizenSubmissions } from '@/lib/submissions'
import { cn } from '@/lib/utils'

/**
 * Header shared by both campaign types. The right column branches on type:
 * an interpellation gets its photo plus a floating stat card; a petition
 * gets the counter card instead — which is where the primary signing CTA
 * lives, hence `signing` being passed through to it.
 */
export function CampaignHeader({
  campaign,
  lang,
  signing,
  mine,
}: {
  campaign: CampaignDetail
  lang: Locale
  signing: SigningState
  mine: CitizenSubmissions
}) {
  const isPetition = campaign.type === 'petition'
  const dateRange = [campaign.startDate, campaign.endDate]
    .filter((date): date is string => Boolean(date))
    .map((date) => formatDate(date, lang))

  return (
    <section className="mx-auto max-w-[var(--container-max)] px-6 pt-5">
      <div className="mb-2 text-[0.85rem] font-semibold text-ink-60">
        <Link href={`/${lang}`} className="hover:text-ink">
          Mobilisations
        </Link>{' '}
        /{' '}
        <Link href={`/${lang}/${campaign.organization.slug}`} className="hover:text-ink">
          {campaign.organization.name}
        </Link>
      </div>

      {/* Interpellation: `items-start`, not `stretch` — stretching the image
          column to match the text column's height (via `h-full` on an
          aspect-ratio box) hits a Chromium grid bug where fr-track widths and
          the row height are miscomputed once the text wraps to 3 lines, and
          the header overflows into the section below it. The image keeps its
          own aspect ratio instead. Petition: the counter card has no such
          bug, so it centers against the text column as the prototype does. */}
      <div
        className={cn(
          'grid gap-8',
          isPetition
            ? 'items-center min-[860px]:grid-cols-[1.1fr_1fr]'
            : 'items-start min-[860px]:grid-cols-[1.4fr_1fr]',
        )}
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Sticker tone={isPetition ? 'accent' : 'yellow'} rotate={-3}>
              {isPetition ? 'Pétition' : 'Interpellation'}
            </Sticker>
            <StatusBadge status={campaign.status} />
            {dateRange.length > 0 && <Pill tone="soft">📅 {dateRange.join(' → ')}</Pill>}
          </div>
          <Display as="h1" opsz={68} className="text-[clamp(40px,5.5vw,68px)]">
            {campaign.title}
          </Display>
          {campaign.tagline && (
            <p className="m-0 max-w-[580px] text-[clamp(16px,1.5vw,20px)] leading-[1.45] font-medium text-ink-60">
              {campaign.tagline}
            </p>
          )}
          <div className="mt-1 flex items-center gap-2.5">
            <InitialsAvatar
              name={campaign.organization.name}
              src={campaign.organization.logoUrl}
              size={34}
              ring={campaign.organization.color ?? 'var(--accent)'}
              filled
            />
            <div>
              <div className="text-sm font-extrabold">{campaign.organization.name}</div>
              <div className="text-[0.78rem] text-ink-60">porte cette campagne</div>
            </div>
          </div>
        </div>

        {campaign.type === 'petition' ? (
          <CounterCard campaign={campaign} lang={lang} signing={signing} />
        ) : (
          <InterpellationVisual campaign={campaign} lang={lang} mine={mine} />
        )}
      </div>
    </section>
  )
}
