import { Card } from '@/components/brand/card'
import type { TimelineStep } from '@/lib/campaigns'
import { cn } from '@/lib/utils'

/** « Où en est le combat » rail. Renders nothing when `steps` is empty. */
export function Timeline({ steps }: { steps: TimelineStep[] }) {
  if (steps.length === 0) return null

  return (
    <section className="mx-auto max-w-[var(--container-max)] px-6 pt-14">
      <Card className="px-7 py-6.5">
        <div className="mb-4.5 text-[0.78rem] font-extrabold tracking-[0.06em] text-ink-60 uppercase">
          Où en est le combat
        </div>
        <div className="flex gap-0 overflow-x-auto pb-1">
          {steps.map((step, index) => {
            const railColor = step.state === 'upcoming' ? 'bg-ink-12' : 'bg-ink'
            const dotColor =
              step.state === 'current'
                ? 'bg-accent shadow-[0_0_0_5px_rgba(232,84,43,0.2)]'
                : step.state === 'done'
                  ? 'bg-ink'
                  : 'bg-card'

            return (
              <div key={index} className="relative min-w-[150px] flex-1 pt-6.5">
                <div className={cn('absolute top-2 right-0 left-0 h-[3px]', railColor)} />
                {/* Mask the rail before the first step and after the last, so it doesn't
                    overhang the row. `bg-card`, matching this Card's own background — not
                    `bg-paper`, which is a visibly different cream and would leave a stripe. */}
                {index === 0 && <div className="absolute top-2 left-0 h-[3px] w-1/2 bg-card" />}
                {index === steps.length - 1 && (
                  <div className="absolute top-2 right-0 left-1/2 h-[3px] bg-card" />
                )}
                <div
                  className={cn(
                    'absolute top-0 left-[calc(50%-9px)] size-[18px] rounded-full border-[length:var(--bd-w)] border-ink',
                    dotColor,
                  )}
                />
                <div className="px-2 text-center">
                  {step.state === 'current' && (
                    <div className="mb-0.5 text-[11px] font-extrabold tracking-[0.04em] text-accent uppercase">
                      On en est là
                    </div>
                  )}
                  <div className="text-sm leading-[1.15] font-extrabold text-ink">{step.label}</div>
                  {step.dateLabel && (
                    <div className="mt-0.5 text-[0.78rem] font-semibold text-ink-60">
                      {step.dateLabel}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </Card>
    </section>
  )
}
