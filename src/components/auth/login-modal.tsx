'use client'

import { useState } from 'react'

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
import type { Locale } from '@/lib/locale'

type Step = 'form' | 'sent'

/**
 * "Se connecter" — signup and login are the same flow, magic link only. Two
 * steps: capture the email, wait for the link. There is no in-page "I
 * clicked it" step — the emailed link is a real GET redirect
 * (`verifyMagicLinkRedirect` in `src/endpoints/magicLink.ts`) that lands the
 * citizen back on the site already signed in via a full navigation, so this
 * modal has nothing to do once the link is sent. No cross-tab sync either
 * (out of scope for V0): closing the modal and interacting again after
 * clicking the link is enough for `TopNav` to pick up the new session.
 */
export function LoginModal({ lang }: { lang: Locale }) {
  const [step, setStep] = useState<Step>('form')
  const [email, setEmail] = useState('')
  const [pseudo, setPseudo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const reset = () => {
    setStep('form')
    setEmail('')
    setPseudo('')
    setError(null)
    setLoading(false)
  }

  const submitForm = async () => {
    setError(null)
    setLoading(true)
    try {
      const response = await fetch('/api/citizens/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, pseudo, lang }),
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error ?? 'Une erreur est survenue.')
        return
      }
      setStep('sent')
    } catch {
      setError('Une erreur est survenue. Réessaie.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog onOpenChange={(next) => !next && reset()}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>Se connecter</DialogTrigger>
      <DialogContent>
        {step === 'form' && (
          <>
            <DialogHeader>
              <DialogTitle>Se connecter</DialogTitle>
              <DialogDescription>
                Connexion et inscription, c&apos;est pareil : entre ton email, on t&apos;envoie un
                lien à cliquer. Première connexion&nbsp;? Ton compte se crée tout seul.
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
              <form
                className="flex flex-col gap-4"
                onSubmit={(event) => {
                  event.preventDefault()
                  submitForm()
                }}
              >
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
                  hint="Affiché publiquement"
                  type="text"
                  required
                  value={pseudo}
                  onChange={(event) => setPseudo(event.target.value)}
                  placeholder="Comment tu veux qu'on t'appelle ?"
                />
                {error && <p className="m-0 text-sm font-semibold text-destructive">{error}</p>}
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  full
                  disabled={!email.includes('@') || !pseudo.trim() || loading}
                >
                  Recevoir mon lien de connexion
                </Button>
                {/* No privacy policy page exists yet — plain text, not a dead link, until one does. */}
                <p className="m-0 text-[0.78rem] leading-normal font-medium text-ink-60">
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
              <DialogTitle>Regarde tes mails</DialogTitle>
            </DialogHeader>
            <DialogBody className="text-center">
              <div className="text-4xl">✉️</div>
              <p className="mx-auto mt-3 mb-0 max-w-80 text-[0.95rem] font-medium text-ink-60">
                On a envoyé un lien à <b className="text-ink">{email}</b>. Clique dessus pour te
                connecter — il est valable 30 minutes.
              </p>
            </DialogBody>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
