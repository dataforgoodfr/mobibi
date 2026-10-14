import type { CSSProperties } from 'react'

import { Avatar as AvatarRoot, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

const initialsFrom = (name: string): string =>
  name
    .split(' ')
    .map((word) => word[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

/**
 * Initials avatar with a coloured ring, matching the design handoff's `Avatar`.
 * `filled` swaps the fallback to a solid `ring`-coloured disc (used for
 * organizations); otherwise it is a soft disc with ink text.
 *
 * Named `InitialsAvatar`, not `Avatar`, to stay distinct from the shadcn
 * primitive it wraps (`@/components/ui/avatar`) — this one is generic enough
 * to cover citizens and targets later, not just organizations.
 */
export function InitialsAvatar({
  name,
  src,
  size = 40,
  ring = 'var(--accent)',
  filled,
  className,
}: {
  name: string
  src?: string | null
  size?: number
  ring?: string
  filled?: boolean
  className?: string
}) {
  return (
    <AvatarRoot
      className={cn('size-(--avatar-size)', className)}
      style={{ '--avatar-size': `${size}px`, '--avatar-ring': ring } as CSSProperties}
    >
      {src && <AvatarImage src={src} alt="" />}
      <AvatarFallback
        className={cn(filled && 'text-white')}
        style={{
          background: filled ? ring : undefined,
          fontSize: size * 0.34,
        }}
      >
        {initialsFrom(name)}
      </AvatarFallback>
    </AvatarRoot>
  )
}
