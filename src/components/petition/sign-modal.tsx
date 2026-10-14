'use client'

import { useRouter } from 'next/navigation'
import { useState, type ReactElement } from 'react'

import { Sticker } from '@/components/brand/sticker'
import { TextField } from '@/components/brand/text-field'
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
import type { CampaignAdditionalField } from '@/lib/campaigns'
import type { CitizenIdentity } from '@/lib/citizenSession'
import type { Locale } from '@/lib/locale'

type Step = 'form' | 'sent' | 'done'

/**
 * Who is looking at the petition, and whether they already signed. Resolved
 * server-side on the page (so it survives a reload, unlike anything the modal
 * holds) and threaded down to both CTAs.
 */
export type SigningState = { citizen: CitizenIdentity | null; hasSigned: boolean }

/**
 * « Je signe la pétition ». Mirrors `auth/login-modal.tsx` — same dialog
 * primitives, same fetch-and-branch shape — but posts to
 * `/api/petitions/:id/sign`, which decides the outcome:
 *
 * - signed in → the signature is written now, and the modal ends on `done`;
 * - anonymous → a magic link carries the form, and the modal ends on `sent`.
 *   The signature is written when the link is clicked, not here (CLAUDE.md:
 *   no optimistic counters).
 *
 * The refresh happens when the modal is CLOSED, not when the signature lands:
 * refreshing while `done` is on screen would re-render the page underneath and
 * unmount this modal out from under the citizen reading it. Closing is also
 * the moment the page behind needs to catch up — it still shows the
 * pre-signature count and CTA until then.
 */
export function SignModal({
  petitionId,
  petitionTitle,
  additionalFields,
  citizen,
  lang,
  trigger,
}: {
  petitionId: number
  petitionTitle: string
  additionalFields: CampaignAdditionalField[]
  citizen: CitizenIdentity | null
  lang: Locale
  trigger: ReactElement
}) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('form')
  const [email, setEmail] = useState(citizen?.email ?? '')
  const [pseudo, setPseudo] = useState(citizen?.pseudo ?? '')
  const [city, setCity] = useState('')
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const reset = () => {
    setStep('form')
    setPseudo(citizen?.pseudo ?? '')
    setCity('')
    setAnswers({})
    setError(null)
    setLoading(false)
  }

  const submit = async () => {
    setError(null)
    setLoading(true)
    try {
      const response = await fetch(`/api/petitions/${petitionId}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lang,
          // Both come from the account when there is one, and the endpoint
          // reads neither in that case — sending them would be noise.
          email: citizen ? undefined : email,
          pseudo: citizen ? undefined : pseudo,
          city: city || undefined,
          responses: additionalFields.map((field) => ({
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
      if (data.status === 'already-signed') {
        setError('Tu as déjà signé cette pétition — une adresse, une signature.')
        return
      }

      setStep(data.status === 'signed' ? 'done' : 'sent')
    } catch {
      setError('Une erreur est survenue. Réessaie.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      onOpenChange={(next) => {
        if (next) return
        // Only after a signature actually landed: the page behind is still
        // rendering the pre-signature count and CTA.
        if (step === 'done') router.refresh()
        reset()
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent>
        {step === 'form' && (
          <>
            <DialogHeader>
              <DialogTitle>Signer la pétition</DialogTitle>
              <DialogDescription>{petitionTitle}</DialogDescription>
            </DialogHeader>
            <DialogBody>
              <form
                className="flex flex-col gap-4"
                onSubmit={(event) => {
                  event.preventDefault()
                  submit()
                }}
              >
                {/* Signed in: the email is the identity the signature is keyed on. */}
                <TextField
                  label="Email"
                  type="email"
                  required
                  autoFocus={!citizen}
                  disabled={Boolean(citizen)}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="prenom@email.fr"
                />
                <TextField
                  label="Pseudo"
                  hint="(affiché publiquement)"
                  type="text"
                  required
                  disabled={Boolean(citizen)}
                  value={pseudo}
                  onChange={(event) => setPseudo(event.target.value)}
                  placeholder="Comment t'afficher dans la liste"
                />
                <TextField
                  label="Ville"
                  hint="(optionnel, affiché publiquement)"
                  type="text"
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  placeholder="Où tu signes depuis"
                />
                {additionalFields.map((field) => (
                  <TextField
                    key={field.index}
                    label={field.label}
                    hint={field.required ? undefined : '(optionnel)'}
                    required={field.required}
                    type="text"
                    value={answers[field.index] ?? ''}
                    onChange={(event) =>
                      setAnswers((current) => ({ ...current, [field.index]: event.target.value }))
                    }
                  />
                ))}
                {error && <p className="m-0 text-sm font-semibold text-destructive">{error}</p>}
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  full
                  disabled={!email.includes('@') || !pseudo.trim() || loading}
                >
                  {citizen ? '✍️ Signer maintenant' : '✍️ Signer — recevoir mon lien'}
                </Button>
                <p className="m-0 text-[0.78rem] leading-normal font-medium text-ink-60">
                  Une adresse = une signature. On vérifie ton email en envoyant un lien à cliquer.
                  <br />
                  On ne partage jamais tes données avec des tiers, seule l&apos;association derrière
                  la campagne à laquelle tu participes y a accès.
                </p>
              </form>
            </DialogBody>
          </>
        )}

        {step === 'sent' && (
          <>
            <DialogHeader>
              <DialogTitle>Vérifie ton email</DialogTitle>
            </DialogHeader>
            <DialogBody className="text-center">
              <div className="text-4xl">✉️</div>
              <p className="mx-auto mt-3 mb-0 max-w-80 text-[0.95rem] font-medium text-ink-60">
                Clique sur le lien envoyé à <b className="text-ink">{email}</b> pour valider ta
                signature — il est valable 30 minutes. Ta signature ne compte qu&apos;une fois le
                lien cliqué.
              </p>
            </DialogBody>
          </>
        )}

        {step === 'done' && (
          <>
            <DialogHeader>
              <DialogTitle>C&apos;est signé. Merci&nbsp;!</DialogTitle>
            </DialogHeader>
            <DialogBody className="text-center">
              <Sticker tone="accent" rotate={-4}>
                signature enregistrée
              </Sticker>
              <p className="mx-auto mt-4 mb-0 max-w-96 text-[0.95rem] font-medium text-ink-60">
                Ta voix rejoint toutes les autres. Le plus utile maintenant&nbsp;: en parler autour
                de toi.
              </p>
            </DialogBody>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
