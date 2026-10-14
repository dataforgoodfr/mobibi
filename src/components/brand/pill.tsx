import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

const TONES = {
  soft: 'bg-soft text-ink',
  ink: 'bg-ink text-paper',
  accent: 'bg-accent text-white',
  outline: 'bg-transparent text-ink shadow-[inset_0_0_0_1.5px_var(--ink-12)]',
} as const

export function Pill({
  children,
  tone = 'soft',
  className,
}: {
  children: ReactNode
  tone?: keyof typeof TONES
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.78rem] font-bold tracking-[0.01em]',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
