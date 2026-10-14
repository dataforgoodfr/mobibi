import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

const TONES = {
  yellow: 'bg-accent-2 text-ink',
  accent: 'bg-accent text-white',
  ink: 'bg-ink text-paper',
} as const

export function Sticker({
  children,
  tone = 'yellow',
  rotate = -4,
  className,
}: {
  children: ReactNode
  tone?: keyof typeof TONES
  rotate?: number
  className?: string
}) {
  return (
    <span
      className={cn(
        'font-display inline-block rounded-[var(--radius-sm)] border-[length:var(--bd-w)] border-ink px-3.5 py-1.5 text-sm leading-none font-extrabold tracking-[0.02em] whitespace-nowrap uppercase shadow-[var(--shadow-sm)]',
        TONES[tone],
        className,
      )}
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      {children}
    </span>
  )
}
