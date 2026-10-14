'use client'

import { useRouter } from 'next/navigation'
import { useState, type ReactElement } from 'react'

import { channelLabel, ChannelIcon } from '@/components/brand/channel-icon'
import { CopyField } from '@/components/brand/copy-field'
import { Sticker } from '@/components/brand/sticker'
import { TextAreaField, TextField } from '@/components/brand/text-field'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import type { ChannelType } from '@/fields/channels'
import type { CitizenIdentity } from '@/lib/citizenSession'
import type { Locale } from '@/lib/locale'
import type { ResolvedChannel, ResolvedTarget } from '@/lib/resolveTarget'

type Step = 'channel' | 'message' | 'declare' | 'sent' | 'done'

const CHANNEL_COPY: Record<
  ChannelType,
  { title: string; valueLabel: string; messageLabel: string; action: string; hint?: string }
> = {
  email: {
    title: 'Interpeller par email',
    valueLabel: 'Destinataire',
    messageLabel: 'Message',
    action: 'Ouvrir mon outil mail ↗',
    hint: "Pas d'outil de mail configuré ? Copie le destinataire, l'objet et le message, puis colle-les dans ta messagerie.",
  },
  twitter: {
    title: 'Interpeller sur Twitter / X',
    valueLabel: 'Compte',
    messageLabel: 'Tweet à publier',
    action: 'Ouvrir Twitter / X ↗',
    hint: 'On a préparé ton tweet. Vérifie-le, ajoute ta touche, et publie.',
  },
  instagram: {
    title: 'Interpeller sur Instagram',
    valueLabel: 'Compte',
    messageLabel: 'Message à envoyer',
    action: 'Ouvrir Instagram ↗',
    hint: "Instagram n'ouvre pas les messages pré-remplis : copie le texte, puis colle-le dans un DM ou un commentaire.",
  },
  phone: {
    title: 'Interpeller par téléphone',
    valueLabel: 'Numéro',
    messageLabel: 'Ce que tu peux dire',
    action: 'Appeler ↗',
  },
}

/**
 * Where the « ouvrir » button sends the citizen, per channel. The one place
 * that knows how each platform is addressed — adding a `CHANNEL_TYPES` entry
 * means adding its link here (see `src/fields/channels.ts`).
 *
 * The mailto query is built by hand rather than with `URLSearchParams`, which
 * encodes spaces as `+`: mail clients percent-decode a mailto body but do not
 * treat `+` as a space, so every space in the message would arrive as a literal
 * plus sign.
 */
const deepLink = (channel: ResolvedChannel): string => {
  switch (channel.type) {
    case 'email': {
      const query = [
        channel.subject ? `subject=${encodeURIComponent(channel.subject)}` : null,
        `body=${encodeURIComponent(channel.message)}`,
      ]
        .filter(Boolean)
        .join('&')
      return `mailto:${channel.value}?${query}`
    }
    case 'twitter':
      return `https://twitter.com/intent/tweet?text=${encodeURIComponent(channel.message)}`
    case 'instagram':
      return `https://instagram.com/${channel.value.replace(/^@/, '')}`
    case 'phone':
      return `tel:${channel.value.replace(/[^\d+]/g, '')}`
  }
}

/**
 * Step-back affordance. Every step after the first has one, so nothing in the
 * flow is a one-way door: a citizen who picked the wrong channel, or who wants
 * to re-read the message before declaring, walks back rather than closing the
 * modal and losing what they typed.
 */
function BackLink({ onClick, children }: { onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer self-start text-[0.85rem] font-bold text-ink-60 hover:text-ink"
    >
      {children}
    </button>
  )
}

/**
 * « J'ai interpellé ». The interpellation twin of `petition/sign-modal.tsx` —
 * same dialog primitives, same fetch-and-branch shape — but with a message
 * step in front of the declaration, and posting to
 * `/api/campaign-targets/:id/interpellate`, which decides the outcome:
 *
 * - signed in → the submission is written now, and the modal ends on `done`;
 * - anonymous → a magic link carries the declaration, and the modal ends on
 *   `sent`. The submission is written when the link is clicked, not here
 *   (CLAUDE.md: no optimistic counters).
 *
 * The refresh happens when the modal is CLOSED, not when the submission lands:
 * refreshing while `done` is on screen would re-render the page underneath and
 * unmount this modal out from under the citizen reading it.
 */
export function InterpellerModal({
  target,
  citizen,
  lang,
  trigger,
}: {
  target: ResolvedTarget
  citizen: CitizenIdentity | null
  lang: Locale
  trigger: ReactElement
}) {
  const router = useRouter()
  // One channel means no choice to make — the prototype skips straight to it.
  const soleChannel = target.channels.length === 1 ? target.channels[0] : null

  const [step, setStep] = useState<Step>(soleChannel ? 'message' : 'channel')
  const [channel, setChannel] = useState<ResolvedChannel | null>(soleChannel)
  const [email, setEmail] = useState(citizen?.email ?? '')
  const [pseudo, setPseudo] = useState(citizen?.pseudo ?? '')
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const reset = () => {
    setStep(soleChannel ? 'message' : 'channel')
    setChannel(soleChannel)
    setAnswers({})
    setError(null)
    setLoading(false)
  }

  const submit = async () => {
    if (!channel) return
    setError(null)
    setLoading(true)
    try {
      const response = await fetch(`/api/campaign-targets/${target.id}/interpellate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lang,
          channelId: channel.id,
          // Both come from the account when there is one, and the endpoint
          // reads neither in that case — sending them would be noise.
          email: citizen ? undefined : email,
          pseudo: citizen ? undefined : pseudo,
          feedback: channel.feedbackFields.map((field) => ({
            index: field.index,
            value: answers[field.index] ?? '',
          })),
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        setError(data.error ?? 'Une erreur est survenue.')
        return
      }

      setStep(data.status === 'submitted' ? 'done' : 'sent')
    } catch {
      setError('Une erreur est survenue. Réessaie.')
    } finally {
      setLoading(false)
    }
  }

  const copy = channel ? CHANNEL_COPY[channel.type] : null
  const title: Record<Step, string> = {
    channel: "Comment l'interpeller ?",
    message: copy?.title ?? 'Interpeller',
    declare: "J'ai interpellé",
    sent: 'Vérifie ton email',
    done: "Merci, c'est compté !",
  }

  return (
    <Dialog
      onOpenChange={(next) => {
        if (next) return
        // Only after a submission actually landed: the page behind is still
        // rendering the pre-submission counters.
        if (step === 'done') router.refresh()
        reset()
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title[step]}</DialogTitle>
          {step !== 'done' && (
            <DialogDescription>
              {[target.fullName, [target.role, target.district].filter(Boolean).join(', ')]
                .filter(Boolean)
                .join(' · ')}
            </DialogDescription>
          )}
        </DialogHeader>

        {step === 'channel' && (
          <DialogBody className="flex flex-col gap-3">
            <p className="m-0 text-[0.95rem] font-medium text-ink-60">
              Choisis le canal qui te va. On te prépare le message, tu n&apos;as plus qu&apos;à
              l&apos;envoyer.
            </p>
            {target.channels.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  setChannel(option)
                  setStep('message')
                }}
                className="flex cursor-pointer items-center gap-3.5 rounded-[var(--radius)] border-[length:var(--bd-w)] border-ink bg-card p-4 text-left shadow-[var(--shadow-sm)] transition-[transform,box-shadow] duration-100 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[var(--shadow)]"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-soft text-ink">
                  <ChannelIcon type={option.type} size={20} />
                </span>
                <span className="flex-1">
                  <span className="block text-base font-extrabold">
                    {channelLabel(option.type)}
                  </span>
                  <span className="block text-[0.82rem] font-semibold text-ink-60">
                    {option.value}
                  </span>
                </span>
                <span className="font-display text-xl text-accent">→</span>
              </button>
            ))}
          </DialogBody>
        )}

        {step === 'message' && channel && copy && (
          <DialogBody className="flex flex-col gap-4">
            {target.channels.length > 1 && (
              <BackLink onClick={() => setStep('channel')}>← Changer de canal</BackLink>
            )}
            {copy.hint && <p className="m-0 text-[0.95rem] font-medium text-ink-60">{copy.hint}</p>}
            <CopyField label={copy.valueLabel} value={channel.value} />
            {channel.type === 'email' && channel.subject && (
              <CopyField label="Objet" value={channel.subject} />
            )}
            <CopyField label={copy.messageLabel} value={channel.message} multiline />
            <div className="flex flex-wrap gap-2.5">
              <Button
                variant="primary"
                size="md"
                // A real link, so it opens `mailto:` / `tel:` / a new tab the
                // way the browser expects. `nativeButton={false}` tells base-ui
                // the rendered element is not a <button> — without it, it warns
                // and applies button semantics that don't fit an anchor.
                nativeButton={false}
                render={<a href={deepLink(channel)} target="_blank" rel="noreferrer" />}
              >
                {copy.action}
              </Button>
              <Button variant="outline" size="md" onClick={() => setStep('declare')}>
                J&apos;ai interpellé
              </Button>
            </div>
          </DialogBody>
        )}

        {step === 'declare' && channel && (
          <DialogBody>
            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault()
                submit()
              }}
            >
              <BackLink onClick={() => setStep('message')}>← Revoir le message</BackLink>

              <p className="m-0 rounded-[var(--radius)] border-[length:var(--bd-w)] border-ink bg-soft px-4 py-3.5 text-[0.9rem] leading-snug font-semibold">
                Tu as bien contacté <b>{target.fullName}</b> ? Valide pour faire grimper le compteur
                de la campagne.
              </p>

              {!citizen && (
                <>
                  <TextField
                    label="Email"
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="prenom@email.fr"
                  />
                  <TextField
                    label="Pseudo"
                    hint="(affiché publiquement)"
                    type="text"
                    required
                    value={pseudo}
                    onChange={(event) => setPseudo(event.target.value)}
                    placeholder="Comment t'appeler"
                  />
                </>
              )}

              {channel.feedbackFields.map((field) => (
                <TextAreaField
                  key={field.index}
                  label={field.label}
                  hint="(optionnel)"
                  value={answers[field.index] ?? ''}
                  onChange={(event) =>
                    setAnswers((current) => ({ ...current, [field.index]: event.target.value }))
                  }
                  placeholder="Écris ici…"
                />
              ))}

              {error && <p className="m-0 text-sm font-semibold text-destructive">{error}</p>}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                full
                disabled={loading || (!citizen && (!email.includes('@') || !pseudo.trim()))}
              >
                {citizen
                  ? `✊ Valider — j'ai interpellé ${target.firstName}`
                  : '✊ Valider — recevoir mon lien'}
              </Button>
              {!citizen && (
                <p className="m-0 text-[0.78rem] leading-normal font-medium text-ink-60">
                  On t&apos;enverra un lien pour confirmer ton email — ton interpellation ne compte
                  qu&apos;une fois le lien cliqué.
                  <br />
                  On ne partage jamais tes données avec des tiers, seule l&apos;association derrière
                  la campagne à laquelle tu participes y a accès.
                </p>
              )}
            </form>
          </DialogBody>
        )}

        {step === 'sent' && (
          <DialogBody className="text-center">
            <div className="text-4xl">✉️</div>
            <p className="mx-auto mt-3 mb-0 max-w-80 text-[0.95rem] font-medium text-ink-60">
              Clique sur le lien envoyé à <b className="text-ink">{email}</b> pour valider ton
              interpellation auprès de <b className="text-ink">{target.fullName}</b> — il est
              valable 30 minutes.
            </p>
          </DialogBody>
        )}

        {step === 'done' && (
          <DialogBody className="text-center">
            <Sticker tone="accent" rotate={-4}>
              +1 interpellation
            </Sticker>
            <p className="mx-auto mt-4 mb-0 max-w-96 text-[0.95rem] font-medium text-ink-60">
              Tu viens d&apos;interpeller <b className="text-ink">{target.fullName}</b>. Chaque
              message pèse — et il en reste à contacter.
            </p>
          </DialogBody>
        )}
      </DialogContent>
    </Dialog>
  )
}
