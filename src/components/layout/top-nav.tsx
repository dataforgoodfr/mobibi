import { headers } from 'next/headers'
import Link from 'next/link'
import { getPayload } from 'payload'

import { CitizenMenu } from '@/components/auth/citizen-menu'
import { LoginModal } from '@/components/auth/login-modal'
import { Logo } from '@/components/brand/logo'
import { getCitizen, toCitizenIdentity } from '@/lib/citizenSession'
import type { Locale } from '@/lib/locale'
import { cn } from '@/lib/utils'
import config from '@payload-config'

/**
 * Server component — reads the citizen session (if any) on every render, so
 * the post-login `router.refresh()` in `LoginModal`/`CitizenMenu` actually
 * reflects the newly-set cookie. Keep it server-side: a client-side TopNav
 * holding citizen state in `useState` would not pick up a cookie set by a
 * `fetch` response without extra plumbing this project doesn't build.
 */
export async function TopNav({ lang }: { lang: Locale }) {
  const payload = await getPayload({ config })
  const citizen = await getCitizen(payload, await headers())

  return (
    <header className="sticky top-0 z-40 border-b-[length:var(--bd-w)] border-ink bg-paper">
      <div className="mx-auto flex max-w-[var(--container-max)] items-center gap-5 px-6 py-3.5">
        <Logo lang={lang} />
        <span className="border-l-[length:var(--bd-w)] border-ink pl-3.5 text-[0.8rem] font-bold tracking-[0.01em] text-ink-60">
          Mobilisation citoyenne
        </span>
        <div className="flex-1" />
        <nav className="flex items-center gap-1.5">
          <Link
            href={`/${lang}`}
            className={cn(
              'rounded-full px-3.5 py-2 text-sm font-extrabold text-ink transition-colors hover:bg-ink-12',
            )}
          >
            Mobilisations
          </Link>
          {citizen ? (
            <CitizenMenu citizen={toCitizenIdentity(citizen)} />
          ) : (
            <LoginModal lang={lang} />
          )}
        </nav>
      </div>
    </header>
  )
}
