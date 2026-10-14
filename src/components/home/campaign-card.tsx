import Image from 'next/image'
import Link from 'next/link'

import { InitialsAvatar } from '@/components/brand/avatar'
import { Card } from '@/components/brand/card'
import { ImageSlot } from '@/components/brand/image-slot'
import { Sticker } from '@/components/brand/sticker'
import { StatusBadge } from '@/components/brand/status-badge'
import { Button } from '@/components/ui/button'
import { Progress, ProgressIndicator, ProgressTrack } from '@/components/ui/progress'
import { campaignPath, type CampaignSummary } from '@/lib/campaigns'
import { formatCount } from '@/lib/format'
import type { Locale } from '@/lib/locale'

export function CampaignCard({ campaign, lang }: { campaign: CampaignSummary; lang: Locale }) {
  const isPetition = campaign.type === 'petition'

  return (
    <Link href={campaignPath(lang, campaign.organization.slug, campaign.slug)} className="block">
      <Card hover className="flex h-full flex-col overflow-hidden">
        <div className="relative">
          {campaign.photoUrl ? (
            <Image
              src={campaign.photoUrl}
              alt=""
              width={800}
              height={400}
              className="aspect-[16/8] w-full border-0 border-b-[length:var(--bd-w)] border-ink object-cover"
            />
          ) : (
            <ImageSlot
              label="Photo à venir"
              ratio="16/8"
              className="rounded-none border-0 border-b-[length:var(--bd-w)] border-ink"
            />
          )}
          <div className="absolute top-3.5 left-3.5">
            <Sticker tone={isPetition ? 'accent' : 'yellow'} rotate={-3}>
              {isPetition ? 'Pétition' : 'Interpellation'}
            </Sticker>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-3 p-[var(--pad)]">
          <div className="flex items-center gap-2.5">
            <InitialsAvatar
              name={campaign.organization.name}
              src={campaign.organization.logoUrl}
              size={26}
              ring={campaign.organization.color ?? 'var(--accent)'}
              filled
            />
            <span className="text-[0.8rem] font-bold text-ink-60">
              {campaign.organization.name}
            </span>
            <div className="flex-1" />
            <StatusBadge status={campaign.status} />
          </div>
          <h3 className="font-display text-2xl leading-[1.08] font-extrabold text-ink uppercase [text-wrap:pretty]">
            {campaign.title}
          </h3>
          {campaign.tagline && (
            <p className="m-0 flex-1 text-[0.9rem] leading-normal text-ink-60">
              {campaign.tagline}
            </p>
          )}
          <div className="mt-1 flex items-end justify-between gap-3">
            <div>
              <div className="font-display text-3xl leading-none font-extrabold text-accent">
                {formatCount(campaign.count, lang)}
              </div>
              <div className="text-[0.78rem] font-bold text-ink-60">
                {isPetition ? 'signatures' : 'interpellations'}
              </div>
            </div>
            <Button variant={isPetition ? 'primary' : 'dark'} size="sm">
              {isPetition ? 'Signer' : 'Interpeller'} →
            </Button>
          </div>
          {isPetition && campaign.nextTier && (
            <div className="mt-0.5">
              <Progress value={Math.min(100, (campaign.count / campaign.nextTier.threshold) * 100)}>
                <ProgressTrack className="h-2.5">
                  <ProgressIndicator />
                </ProgressTrack>
              </Progress>
              <div className="mt-1.5 text-xs font-bold text-ink-60">
                Prochain palier : {formatCount(campaign.nextTier.threshold, lang)} —{' '}
                {campaign.nextTier.label}
              </div>
            </div>
          )}
        </div>
      </Card>
    </Link>
  )
}
