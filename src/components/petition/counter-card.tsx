'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import { Card } from '@/components/brand/card'
import { SignModal, type SigningState } from '@/components/petition/sign-modal'
import { Button } from '@/components/ui/button'
import { Progress, ProgressIndicator, ProgressTrack } from '@/components/ui/progress'
import type { CampaignDetail } from '@/lib/campaigns'
import { formatCount } from '@/lib/format'
import type { Locale } from '@/lib/locale'

const COUNT_UP_MS = 1300
const easeOutCubic = (p: number) => 1 - (1 - p) ** 3

// useLayoutEffect warns when a client component is server-rendered; useEffect
// would paint the final number for one frame before it jumps back to 0.
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

/**
 * The petition header's hero: big animated count, progress toward the next
 * tier, and the primary signing CTA. Initialises state to the real `count` so
 * no-JS / pre-hydration HTML carries the true number, then resets to 0 and
 * starts the count-up before paint.
 */
export function CounterCard({
  campaign,
  lang,
  signing,
}: {
  campaign: Extract<CampaignDetail, { type: 'petition' }>
  lang: Locale
  signing: SigningState
}) {
  const { count, nextTier } = campaign
  const [displayed, setDisplayed] = useState(count)
  const frame = useRef<number>(undefined)

  useIsoLayoutEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) {
      setDisplayed(count)
      return
    }

    setDisplayed(0)
    const start = performance.now()

    const tick = (now: number) => {
      const p = Math.min((now - start) / COUNT_UP_MS, 1)
      setDisplayed(Math.round(easeOutCubic(p) * count))
      if (p < 1) frame.current = requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)

    return () => {
      if (frame.current !== undefined) cancelAnimationFrame(frame.current)
    }
  }, [count])

  const progress = nextTier ? Math.min(100, (count / nextTier.threshold) * 100) : 100
  const remaining = nextTier ? Math.max(0, nextTier.threshold - count) : 0

  return (
    <Card className="p-[var(--pad)] text-center">
      <div
        className="font-display text-[clamp(64px,10vw,128px)] leading-[0.85] tracking-[-0.02em] text-accent"
        data-testid="petition-count"
      >
        {formatCount(displayed, lang)}
      </div>
      <div className="mt-2 text-sm font-bold text-ink-60">signatures et ça continue de monter</div>

      {nextTier && (
        <div className="mt-5">
          <Progress value={progress}>
            <ProgressTrack className="h-3.5">
              <ProgressIndicator />
            </ProgressTrack>
          </Progress>
          <div className="mt-2 text-[0.85rem] font-bold text-ink-60">
            {remaining > 0 ? (
              <>
                Prochain palier : {formatCount(nextTier.threshold, lang)} — « {nextTier.label} » ·
                plus que {formatCount(remaining, lang)}
              </>
            ) : (
              // `nextTier` falls back to the last tier once every threshold is
              // met (see `resolvePetition`) — say so instead of leaving the
              // 100% bar with no label at all.
              <>Tous les paliers sont atteints 🎉</>
            )}
          </div>
        </div>
      )}

      {signing.hasSigned ? (
        <Button variant="outline" size="lg" full className="mt-5" disabled>
          ✓ Tu as signé — merci&nbsp;!
        </Button>
      ) : (
        <SignModal
          petitionId={campaign.id}
          petitionTitle={campaign.title}
          additionalFields={campaign.additionalFields}
          citizen={signing.citizen}
          lang={lang}
          trigger={
            <Button variant="primary" size="lg" full className="mt-5">
              ✍️ Je signe la pétition
            </Button>
          }
        />
      )}
      <div className="mt-2.5 text-xs font-semibold text-ink-60">
        Gratuit · sans pub · email vérifié par lien magique
      </div>
    </Card>
  )
}
