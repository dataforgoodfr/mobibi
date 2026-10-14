import Link from 'next/link'
import type { ReactNode } from 'react'

import type { Locale } from '@/lib/locale'
import { cn } from '@/lib/utils'

/** Wordmark "mobibi": the two "i"s carry a coloured dot, accent then accent-2. */
export function Logo({ lang, className }: { lang: Locale; className?: string }) {
  return (
    <Link
      href={`/${lang}`}
      aria-label="mobibi — accueil"
      className={cn(
        'font-body inline-flex items-center text-[1.9rem] leading-none font-extrabold tracking-[-0.04em] text-ink',
        className,
      )}
    >
      mob
      <Dot color="var(--accent)">i</Dot>b<Dot color="var(--accent-2)">i</Dot>
    </Link>
  )
}

function Dot({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span className="relative">
      {children}
      <span
        aria-hidden
        className="absolute top-[-0.06em] left-[0.16em] block size-[0.34em] rounded-full"
        style={{ background: color }}
      />
    </span>
  )
}
