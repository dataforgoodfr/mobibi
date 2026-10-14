'use client'

import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Display } from '@/components/brand/display'
import { TargetCard } from '@/components/interpellation/target-card'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { CitizenIdentity } from '@/lib/citizenSession'
import type { Locale } from '@/lib/locale'
import type { ResolvedTarget } from '@/lib/resolveTarget'
import type { CitizenSubmissions } from '@/lib/submissions'

const SORTS = ['moins', 'plus'] as const
type Sort = (typeof SORTS)[number]
const isSort = (value: string): value is Sort => (SORTS as readonly string[]).includes(value)

/**
 * Search + sort run in memory over the full target list handed down from the
 * server. Deliberate for V0: it matches the prototype's instant filtering,
 * needs no API route or loading state, and is honest for today's target
 * counts (a handful per campaign). Revisit once a campaign has hundreds of
 * targets — move to `searchParams` + a server-side query at that point.
 */
export function TargetList({
  targets,
  citizen,
  lang,
  mine,
}: {
  targets: ResolvedTarget[]
  citizen: CitizenIdentity | null
  lang: Locale
  mine: CitizenSubmissions
}) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<Sort>('moins')

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return targets.filter((target) =>
      [target.fullName, target.politicalGroup, target.district, target.role]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q),
    )
  }, [targets, query])

  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) =>
        sort === 'moins'
          ? a.submissionCount - b.submissionCount
          : b.submissionCount - a.submissionCount,
      ),
    [filtered, sort],
  )

  return (
    <section className="mx-auto max-w-[var(--container-max)] px-6 pt-[var(--section-y)]">
      <div className="mb-2 flex flex-wrap items-end justify-between gap-4">
        <Display as="h2" opsz={40} className="text-[2.5rem]">
          Choisis qui interpeller
        </Display>
        <span className="max-w-90 text-sm font-semibold text-ink-60">
          On te suggère de commencer par les <b className="text-ink">moins sollicité·es</b> —
          c&apos;est là que ta voix change le plus.
        </span>
      </div>

      <div className="my-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-60 flex-1">
          <label htmlFor="target-search" className="sr-only">
            Chercher une cible par nom, groupe ou département
          </label>
          <Search
            aria-hidden
            size={18}
            className="absolute top-1/2 left-4 -translate-y-1/2 text-ink-60"
          />
          <input
            id="target-search"
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Chercher par nom, groupe, département…"
            className="w-full rounded-[var(--radius)] border-[length:var(--bd-w)] border-ink bg-card py-3.5 pr-4 pl-11 text-[0.97rem] font-semibold text-ink outline-none"
          />
        </div>
        <ToggleGroup
          value={[sort]}
          onValueChange={(values) => {
            const [next] = values
            if (next && isSort(next)) setSort(next)
          }}
        >
          <ToggleGroupItem value="moins">Moins sollicité·es</ToggleGroupItem>
          <ToggleGroupItem value="plus">Plus sollicité·es</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {sorted.length === 0 ? (
        <p className="py-16 text-center font-semibold text-ink-60">
          Personne ne correspond à « {query} ».
        </p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-[var(--gap)]">
          {sorted.map((target) => (
            <TargetCard key={target.id} target={target} citizen={citizen} lang={lang} mine={mine} />
          ))}
        </div>
      )}
    </section>
  )
}
