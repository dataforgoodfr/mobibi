import type { ElementType, ReactNode } from 'react'

import { cn } from '@/lib/utils'

type DisplayProps = {
  as?: ElementType
  children: ReactNode
  className?: string
  /** Optical size on the `opsz` axis (10–72). Larger reads as the poster cut. */
  opsz?: number
}

/**
 * Display heading — Big Shoulders, uppercase, `text-wrap: pretty`. `opsz`
 * defaults to 48: mid-range between the font's small-text (10) and full
 * poster (72) optical sizes, matched against the design handoff's headings.
 * See the `[lang]/layout.tsx` comment on why `opsz` is set explicitly at all.
 */
export function Display({ as: Tag = 'h2', children, className, opsz = 48 }: DisplayProps) {
  return (
    <Tag
      className={cn(
        'font-display leading-[1.08] font-extrabold tracking-normal text-ink uppercase [text-wrap:pretty]',
        className,
      )}
      style={{ fontVariationSettings: `'opsz' ${opsz}` }}
    >
      {children}
    </Tag>
  )
}
