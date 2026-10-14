import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

/** Bordered surface with the poster's offset shadow. `hover` adds the lift-on-hover interaction. */
export function Card({ className, hover, ...props }: ComponentProps<'div'> & { hover?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-lg)] border-[length:var(--bd-w)] border-ink bg-card shadow-[var(--shadow-sm)]',
        hover &&
          'cursor-pointer transition-[transform,box-shadow] duration-150 ease-out hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[var(--shadow)]',
        className,
      )}
      {...props}
    />
  )
}
