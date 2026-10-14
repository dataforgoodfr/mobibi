import { Mail, Phone } from 'lucide-react'

import type { ChannelType } from '@/fields/channels'

// French UI copy lives here, not in `src/fields/channels.ts` — that file is
// admin configuration and, per CLAUDE.md, the admin interface stays English.
const CHANNEL_LABEL: Record<ChannelType, string> = {
  email: 'Email',
  twitter: 'Twitter / X',
  instagram: 'Instagram',
  phone: 'Téléphone',
}

export const channelLabel = (type: ChannelType): string => CHANNEL_LABEL[type]

// lucide-react 1.23 dropped brand icons (`Twitter`, `Instagram` no longer
// exist), so X and Instagram get small inline SVGs instead — the prototype
// used inline SVG for every channel, so this isn't a regression.
function XIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.9 2H22l-7.6 8.7L23 22h-6.9l-5.4-6.6L4.5 22H1.4l8.1-9.3L1 2h7.1l4.9 6.1L18.9 2Zm-1.2 18h1.9L7.4 4H5.4l12.3 16Z" />
    </svg>
  )
}

function InstagramIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function ChannelIcon({ type, size = 16 }: { type: ChannelType; size?: number }) {
  switch (type) {
    case 'email':
      return <Mail size={size} aria-hidden />
    case 'phone':
      return <Phone size={size} aria-hidden />
    case 'twitter':
      return <XIcon size={size} />
    case 'instagram':
      return <InstagramIcon size={size} />
  }
}
