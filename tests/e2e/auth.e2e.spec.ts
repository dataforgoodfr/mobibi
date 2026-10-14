import { expect, test } from '@playwright/test'
import { getPayload } from 'payload'

import config from '../../src/payload.config'

/** Unique per run so repeated e2e runs never collide. */
const run = Date.now()
const email = `e2e-auth-${run}@example.com`
// `citizens.pseudo` is required, so this is the only name the nav ever shows —
// no email-derived fallback any more.
const displayName = `Sacha ${run}`

test.describe('Citizen auth', () => {
  test.afterAll(async () => {
    const payload = await getPayload({ config })
    await payload.delete({ collection: 'citizens', where: { email: { equals: email } } })
    await payload.delete({ collection: 'magic-links', where: { email: { equals: email } } })
  })

  test('signs in via a real magic-link redirect, persists across reload, and logs out', async ({
    page,
  }) => {
    await page.goto('/fr')

    await page.getByRole('button', { name: 'Se connecter' }).click()
    await page.getByPlaceholder('prenom@email.fr').fill(email)
    await page.getByPlaceholder("Comment tu veux qu'on t'appelle").fill(displayName)

    // The modal has no "I clicked it" shortcut any more — the dev email
    // adapter already logs the full link to the console, and a human just
    // copies it from there. For automation, grab the same `devToken` the
    // response carries (never present outside dev/test — see
    // `requestMagicLink` in `src/endpoints/magicLink.ts`) and use it to
    // reach the verify endpoint the exact way a real emailed link does.
    const requestResponse = page.waitForResponse('**/api/citizens/magic-link')
    await page.getByRole('button', { name: 'Recevoir mon lien de connexion' }).click()
    const { devToken } = await (await requestResponse).json()
    expect(devToken).toBeTruthy()

    await expect(page.getByText('Regarde tes mails')).toBeVisible()

    // A plain GET navigation, exactly what clicking the link in an inbox
    // does — `verifyMagicLinkRedirect` sets the session cookie and redirects
    // to `/fr`.
    await page.goto(`/api/citizens/magic-link/verify?token=${devToken}&lang=fr`)

    // A generous timeout here: this navigation lands on a cold RSC render of
    // `TopNav` (reading the cookie via Payload's local API), and running
    // alongside the rest of the e2e suite's parallel workers can genuinely
    // push a single request past the default 5s under Turbopack's dev-mode
    // compilation — not a race in the auth logic itself (verified directly:
    // the cookie is set synchronously with the redirect response).
    await expect(page.getByText(displayName)).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('button', { name: 'Se connecter' })).not.toBeVisible()

    await page.reload()
    await expect(page.getByText(displayName)).toBeVisible({ timeout: 15000 })

    await page.getByRole('button', { name: 'Se déconnecter' }).click()
    await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible()
    await expect(page.getByText(displayName)).not.toBeVisible()
  })
})
