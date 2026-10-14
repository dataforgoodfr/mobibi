import { Check } from 'lucide-react'

import { InitialsAvatar } from '@/components/brand/avatar'
import { Card } from '@/components/brand/card'
import { channelLabel, ChannelIcon } from '@/components/brand/channel-icon'
import { Pill } from '@/components/brand/pill'
import { InterpellerModal } from '@/components/interpellation/interpeller-modal'
import { Button } from '@/components/ui/button'
import type { CitizenIdentity } from '@/lib/citizenSession'
import { formatCount, formatDate } from '@/lib/format'
import type { Locale } from '@/lib/locale'
import type { ResolvedTarget } from '@/lib/resolveTarget'
import type { CitizenSubmissions } from '@/lib/submissions'

/**
 * « Tu l'as déjà interpellé·e ». Absolutely positioned over the avatar on
 * purpose: the cards share a grid row, so anything that adds a line here makes
 * every card in that row taller. An `absolute` badge takes part in no layout
 * at all, which is what keeps this mark free.
 */
function DoneBadge({ mine, lang }: { mine: { count: number; lastAt: string }; lang: Locale }) {
  const when = formatDate(mine.lastAt, lang)
  const label =
    mine.count > 1
      ? `Tu l'as interpellé·e ${mine.count} fois, la dernière le ${when}`
      : `Tu l'as interpellé·e le ${when}`

  return (
    <span
      data-testid="target-done"
      title={label}
      className="absolute right-0 bottom-0 grid size-6 place-items-center rounded-full border-[length:var(--bd-w)] border-ink bg-accent text-white"
    >
      <Check size={13} strokeWidth={3.5} aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  )
}

export function TargetCard({
  target,
  citizen,
  lang,
  mine,
}: {
  target: ResolvedTarget
  citizen: CitizenIdentity | null
  lang: Locale
  mine: CitizenSubmissions
}) {
  const done = mine.byTarget[target.id]

  return (
    <Card
      hover
      data-testid="target-card"
      className="flex flex-col items-center gap-2.5 p-[var(--pad)] text-center"
    >
      <span className="relative">
        <InitialsAvatar name={target.fullName} size={64} ring="var(--accent)" />
        {done && <DoneBadge mine={done} lang={lang} />}
      </span>
      <div>
        <div data-testid="target-name" className="text-base leading-[1.1] font-extrabold">
          {target.fullName}
        </div>
        <div className="mt-0.5 text-[0.81rem] font-semibold text-ink-60">
          {[target.role, target.district].filter(Boolean).join(' · ')}
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-1.5">
        {target.politicalGroup && <Pill tone="outline">{target.politicalGroup}</Pill>}
        <Pill tone="soft" className="gap-1">
          <span data-testid="target-count" className="font-extrabold text-accent">
            {formatCount(target.submissionCount)}
          </span>
          interpell.
        </Pill>
      </div>
      <div className="mt-0.5 flex gap-1.5">
        {target.channels.map((channel) => (
          <span
            key={channel.id}
            title={channelLabel(channel.type)}
            className="grid size-7.5 place-items-center rounded-full border-[length:var(--bd-w)] border-ink text-ink"
          >
            <ChannelIcon type={channel.type} size={15} />
          </span>
        ))}
      </div>
      <InterpellerModal
        target={target}
        citizen={citizen}
        lang={lang}
        trigger={
          // « Relancer » rather than « Interpeller à nouveau »: the cards floor
          // at 230px and `Button` is `whitespace-nowrap`, so a long label
          // overflows instead of wrapping. It also says the right thing — a
          // repeat is welcome, not a mistake.
          <Button variant="primary" size="sm" full className="mt-1">
            {done ? 'Relancer →' : 'Interpeller →'}
          </Button>
        }
      />
    </Card>
  )
}
