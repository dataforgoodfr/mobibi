import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { Card } from '@/components/brand/card'
import { Display } from '@/components/brand/display'
import { Button } from '@/components/ui/button'
import { getCampaignerAuthConfig } from '@/lib/campaignerAuthConfig'
import { getCampaigner } from '@/lib/campaignerSession'
import { isLocale } from '@/lib/locale'
import config from '@payload-config'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Tableau de bord', robots: { index: false } }

export default async function DashboardPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  if (!isLocale(lang) || getCampaignerAuthConfig().method !== 'oidc') notFound()

  const payload = await getPayload({ config })
  const campaigner = await getCampaigner(payload, await headers())
  if (!campaigner) {
    redirect(`/api/campaigners/oidc/authorize?returnTo=${encodeURIComponent(`/${lang}/dashboard`)}`)
  }

  const identity = campaigner.name ? `${campaigner.name} (${campaigner.email})` : campaigner.email

  return (
    <main className="mx-auto max-w-[var(--container-max)] px-6 py-[var(--section-y)]">
      <Card className="flex flex-col items-start gap-5 p-8">
        <Display as="h1" opsz={40} className="text-[2.5rem]">
          Tableau de bord
        </Display>
        <p className="font-semibold">Connecté·e en tant que {identity}</p>
        <p>Votre compte n&apos;est rattaché à aucune organisation pour le moment.</p>
        <form method="post" action="/api/campaigners/session/logout">
          <Button type="submit" variant="outline">
            Se déconnecter du tableau de bord
          </Button>
        </form>
      </Card>
    </main>
  )
}
