import { InitialsAvatar } from '@/components/brand/avatar'
import { Display } from '@/components/brand/display'
import type { OrganizationSummary } from '@/lib/organizations'

export function OrganizationHeader({ organization }: { organization: OrganizationSummary }) {
  return (
    <section className="mx-auto max-w-[var(--container-max)] px-6 pt-8">
      <div className="flex items-center gap-4">
        <InitialsAvatar
          name={organization.shortName || organization.name}
          src={organization.logoUrl}
          size={64}
          ring={organization.color ?? 'var(--accent)'}
          filled
        />
        <Display as="h1" opsz={56} className="text-[clamp(32px,4.5vw,56px)]">
          {organization.name}
        </Display>
      </div>
      {organization.description && (
        <p className="mt-4 max-w-[640px] text-base leading-relaxed text-ink-60">
          {organization.description}
        </p>
      )}
    </section>
  )
}
