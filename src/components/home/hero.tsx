import { Card } from '@/components/brand/card'
import { Display } from '@/components/brand/display'
import { Sticker } from '@/components/brand/sticker'
import { Button } from '@/components/ui/button'
import { formatCount } from '@/lib/format'
import type { Locale } from '@/lib/locale'

export function Hero({
  interpellationCount,
  signatureCount,
  lang,
}: {
  interpellationCount: number
  signatureCount: number
  lang: Locale
}) {
  return (
    <section className="mx-auto max-w-[var(--container-max)] px-6 pt-[clamp(40px,7vw,90px)] pb-10">
      <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-[1.35fr_1fr]">
        <div className="flex flex-col items-start gap-6">
          <Sticker rotate={-3}>✊ Ta voix compte</Sticker>
          <Display as="h1" opsz={72} className="text-[clamp(44px,6vw,80px)]">
            Fais du bruit.
            <br />
            <span className="text-accent">Change les règles.</span>
          </Display>
          <p className="m-0 max-w-[520px] text-[clamp(17px,1.6vw,21px)] leading-snug font-medium text-ink-60">
            Interpelle tes élu·es, signe les pétitions qui comptent. mobibi rassemble les causes
            portées par les assos — et compte chacune de tes actions.
          </p>
          <div className="mt-1 flex flex-wrap gap-3">
            <Button
              variant="primary"
              size="lg"
              nativeButton={false}
              render={<a href="#liste-mob" />}
            >
              Voir les mobilisations
            </Button>
            {/* No dedicated "how it works" page yet — anchors back to the list. */}
            <Button
              variant="outline"
              size="lg"
              nativeButton={false}
              render={<a href="#liste-mob" />}
            >
              Comment ça marche ?
            </Button>
          </div>
        </div>
        <div className="grid gap-3.5">
          <Card className="rotate-2 px-6 py-5.5">
            <div className="font-display text-5xl leading-none font-extrabold text-ink">
              {formatCount(interpellationCount, lang)}
            </div>
            <div className="text-sm font-bold text-ink-60">interpellations envoyées</div>
          </Card>
          <Card className="-rotate-2 bg-accent px-6 py-5.5 text-white">
            <div className="font-display text-5xl leading-none font-extrabold">
              {formatCount(signatureCount, lang)}
            </div>
            <div className="text-sm font-bold opacity-90">signatures rassemblées</div>
          </Card>
        </div>
      </div>
    </section>
  )
}
