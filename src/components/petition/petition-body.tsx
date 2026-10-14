import { InitialsAvatar } from '@/components/brand/avatar'
import { Card } from '@/components/brand/card'
import { Display } from '@/components/brand/display'
import { Pill } from '@/components/brand/pill'
import { RichText } from '@/components/brand/rich-text'
import { Sticker } from '@/components/brand/sticker'
import { SignModal, type SigningState } from '@/components/petition/sign-modal'
import { Button } from '@/components/ui/button'
import type { CampaignDetail } from '@/lib/campaigns'
import { formatCount, formatRelativeTime } from '@/lib/format'
import type { Locale } from '@/lib/locale'

/**
 * The petition-only part of the campaign page: the text being signed, recent
 * signatures, the tiers list, and the bottom CTA. Mirrors
 * `interpellation/interpellation-body.tsx` so the route's two branches stay
 * symmetrical.
 */
export function PetitionBody({
  campaign,
  lang,
  signing,
}: {
  campaign: Extract<CampaignDetail, { type: 'petition' }>
  lang: Locale
  signing: SigningState
}) {
  return (
    <>
      {signing.hasSigned && (
        <section className="mx-auto max-w-[var(--container-max)] px-6 pt-6">
          <Card className="flex flex-wrap items-center gap-4 border-accent p-[var(--pad)]">
            <Sticker tone="accent" rotate={-4}>
              c&apos;est signé
            </Sticker>
            <div>
              <div className="text-base font-extrabold text-ink">Merci, ta signature compte.</div>
              <p className="m-0 text-sm text-ink-60">
                Le plus utile maintenant&nbsp;: en parler autour de toi.
              </p>
            </div>
          </Card>
        </section>
      )}

      <section className="mx-auto grid max-w-[var(--container-max)] gap-[var(--gap)] px-6 pt-6.5 min-[860px]:grid-cols-[1.5fr_1fr]">
        <Card className="p-[var(--pad)]">
          <Display as="h2" opsz={28} className="mb-2.5 text-2xl">
            Le texte qu&apos;on signe
          </Display>
          <RichText data={campaign.text} className="text-[0.97rem] text-ink-60" />

          {campaign.recentSignatures.length > 0 && (
            <div className="mt-6 border-t border-ink-12 pt-5">
              <div className="mb-3 text-sm font-extrabold text-ink">Dernières signatures</div>
              <ul className="flex flex-col gap-3">
                {campaign.recentSignatures.map((signature, index) => (
                  <li key={index} className="flex items-center gap-2.5">
                    <InitialsAvatar name={signature.pseudo} size={28} />
                    <span className="text-sm font-semibold text-ink">
                      {signature.pseudo}
                      {signature.city && (
                        <span className="font-normal text-ink-60"> · {signature.city}</span>
                      )}
                    </span>
                    <span className="ml-auto text-xs font-semibold text-ink-60">
                      {formatRelativeTime(signature.createdAt, lang)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <Card className="self-start p-[var(--pad)]">
          <Display as="h2" opsz={28} className="mb-1 text-2xl">
            Nos paliers
          </Display>
          <p className="m-0 mb-4 text-sm text-ink-60">
            Chaque seuil débloque une nouvelle étape de la lutte.
          </p>
          <div className="flex flex-col">
            {campaign.tiers.map((tier, index) => {
              const reached = campaign.count >= tier.threshold
              const active = campaign.nextTier?.threshold === tier.threshold
              return (
                <div
                  key={tier.threshold}
                  className={
                    index < campaign.tiers.length - 1
                      ? 'flex items-center gap-3 border-b border-ink-12 py-3'
                      : 'flex items-center gap-3 py-3'
                  }
                >
                  <span
                    className={
                      reached
                        ? 'grid size-6.5 shrink-0 place-items-center rounded-full bg-accent text-xs font-extrabold text-white'
                        : 'grid size-6.5 shrink-0 place-items-center rounded-full bg-soft text-xs font-extrabold text-ink-60'
                    }
                  >
                    {reached ? '✓' : index + 1}
                  </span>
                  <div className="flex-1">
                    <div className="text-sm font-extrabold text-ink">
                      {formatCount(tier.threshold, lang)} signatures
                    </div>
                    <div className="text-[0.8rem] text-ink-60">{tier.label}</div>
                  </div>
                  {active ? (
                    <Pill tone="accent">en cours</Pill>
                  ) : (
                    reached && <Pill tone="soft">atteint</Pill>
                  )}
                </div>
              )
            })}
          </div>
        </Card>
      </section>

      <section className="mx-auto max-w-[var(--container-max)] px-6 pt-[var(--section-y)] pb-[var(--section-y)]">
        <Card className="border-ink bg-ink p-10 text-center text-paper">
          {/* `text-paper`: `Display` defaults to `text-ink`, invisible on this
              card's dark background — overridden here, then the second
              sentence overrides back to `text-accent-2`. */}
          <Display as="h2" opsz={40} className="text-[2.5rem] text-paper">
            On est déjà {formatCount(campaign.count, lang)}.{' '}
            <span className="text-accent-2">Manque plus que toi.</span>
          </Display>
          {signing.hasSigned ? (
            // `border-paper text-paper` for the same reason as the `Display`
            // above: `variant="outline"` is ink-on-transparent, invisible on
            // this card's ink background. The header's identical button
            // (`petition/counter-card.tsx`) sits on a paper card and needs no
            // override — the inconsistency is the point, not a slip.
            <Button variant="outline" size="lg" className="mt-5 border-paper text-paper" disabled>
              ✓ Tu as signé — merci&nbsp;!
            </Button>
          ) : (
            <SignModal
              petitionId={campaign.id}
              petitionTitle={campaign.title}
              additionalFields={campaign.additionalFields}
              citizen={signing.citizen}
              lang={lang}
              trigger={
                <Button variant="yellow" size="lg" className="mt-5">
                  ✍️ Ajouter ma signature
                </Button>
              }
            />
          )}
        </Card>
      </section>
    </>
  )
}
