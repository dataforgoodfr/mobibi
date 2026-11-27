import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { Card } from '@/components/brand/card'
import { Display } from '@/components/brand/display'
import { DEFAULT_LOGIN_ERROR, LOGIN_ERROR_MESSAGES } from '@/components/dashboard/copy'
import { buttonVariants } from '@/components/ui/button'
import { getCampaignerAuthConfig } from '@/lib/campaignerAuthConfig'
import type { LoginErrorCode } from '@/lib/campaignerLogin'
import { isLocale } from '@/lib/locale'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Connexion', robots: { index: false } }

const isLoginErrorCode = (value: unknown): value is LoginErrorCode =>
  typeof value === 'string' && Object.hasOwn(LOGIN_ERROR_MESSAGES, value)

export default async function DashboardLoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>
  searchParams: Promise<{ error?: string | string[] }>
}) {
  const { lang } = await params
  if (!isLocale(lang) || getCampaignerAuthConfig().method !== 'oidc') notFound()

  const { error } = await searchParams
  const message = isLoginErrorCode(error) ? LOGIN_ERROR_MESSAGES[error] : DEFAULT_LOGIN_ERROR
  const retryHref = `/api/campaigners/oidc/authorize?returnTo=${encodeURIComponent(`/${lang}/dashboard`)}`

  return (
    <main className="mx-auto max-w-[var(--container-max)] px-6 py-[var(--section-y)]">
      <Card className="flex flex-col items-start gap-5 p-8">
        <Display as="h1" opsz={40} className="text-[2.5rem]">
          Connexion
        </Display>
        <p>{message}</p>
        {/* A plain anchor, not `Link`: the target is an API route that sets cookies, so no prefetch. */}
        <a href={retryHref} className={buttonVariants()}>
          Réessayer
        </a>
      </Card>
    </main>
  )
}
