import { cn } from '@/lib/utils'

/** Striped placeholder shown wherever a campaign has no `photo` uploaded. */
export function ImageSlot({
  label,
  ratio = '16/7',
  className,
}: {
  label: string
  ratio?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'grid w-full place-items-center overflow-hidden rounded-[var(--radius)] border-[length:var(--bd-w)] border-ink bg-[repeating-linear-gradient(135deg,var(--soft)_0_16px,transparent_16px_32px)] bg-card',
        className,
      )}
      style={{ aspectRatio: ratio }}
    >
      <span className="rounded-md border border-dashed border-ink-12 bg-card px-2.5 py-1 font-mono text-xs tracking-[0.04em] text-ink-60">
        {label}
      </span>
    </div>
  )
}
