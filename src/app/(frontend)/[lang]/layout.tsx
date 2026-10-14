import type { Metadata } from 'next'
import { Big_Shoulders, Hanken_Grotesk } from 'next/font/google'
import { notFound } from 'next/navigation'
import React from 'react'

import { Footer } from '@/components/layout/footer'
import { TopNav } from '@/components/layout/top-nav'
import { isLocale, PUBLIC_LOCALES } from '@/lib/locale'
import '../styles.css'

// `default` covers routes with no `title` of their own (only `/fr` today);
// `template` composes it for every route that sets one, e.g. an organization
// page setting `title: orgName` renders as "OrgName — mobibi".
export const metadata: Metadata = {
  description: 'mobibi — mobilisation citoyenne',
  title: {
    default: 'mobibi — mobilisation citoyenne',
    template: '%s — mobibi',
  },
}

export function generateStaticParams() {
  return PUBLIC_LOCALES.map((lang) => ({ lang }))
}

const hankenGrotesk = Hanken_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-body',
})

// Google merged "Big Shoulders Display" into the "Big Shoulders" variable
// family: it now carries an `opsz` (optical size) axis defaulting to 14,
// which renders as a small-text cut rather than the poster-style display cut
// the design calls for. `font-variation-settings: 'opsz' <size>` on headings
// (see brand/display.tsx) pushes it toward the display end (up to 72).
const bigShoulders = Big_Shoulders({
  subsets: ['latin'],
  weight: 'variable',
  axes: ['opsz'],
  // The merged family name isn't in next/font's fallback-metrics database, so
  // it can't auto-derive a size-matched fallback (harmless "Failed to find
  // font override values" warning) — a condensed fallback is picked by hand
  // instead, since the default sans-serif is visibly wider than this display cut.
  fallback: ['Arial Narrow', 'sans-serif'],
  // Not named `--font-display`: that name is Tailwind's theme token (which
  // aliases to this one in styles.css) and a CSS custom property cannot
  // reference itself.
  variable: '--display-font-family',
})

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()

  return (
    <html lang={lang} className={`${hankenGrotesk.variable} ${bigShoulders.variable}`}>
      <body>
        <div className="min-h-screen bg-paper text-ink">
          <TopNav lang={lang} />
          {children}
          <Footer />
        </div>
      </body>
    </html>
  )
}
