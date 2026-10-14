import type { CampaignStatus } from '@/fields/campaign'

const STATUS_LABEL: Record<CampaignStatus, { label: string; dot: string }> = {
  draft: { label: 'Brouillon', dot: 'var(--ink-60)' },
  upcoming: { label: 'À venir', dot: 'var(--accent-2)' },
  active: { label: 'En cours', dot: 'var(--ok)' },
  archived: { label: 'Archivé', dot: 'var(--ink-60)' },
}

export function StatusBadge({ status }: { status: CampaignStatus }) {
  const { label, dot } = STATUS_LABEL[status]

  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-bold text-ink">
      <span
        aria-hidden
        className="size-2.5 rounded-full"
        style={{
          background: dot,
          boxShadow: `0 0 0 4px color-mix(in srgb, ${dot} 20%, transparent)`,
        }}
      />
      {label}
    </span>
  )
}
