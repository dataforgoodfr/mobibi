import { expect, test, type Page } from '@playwright/test'
import { getPayload } from 'payload'

import config from '../../src/payload.config'
import { login } from '../helpers/login'

const run = Date.now()
// Must match the default user of `tests/helpers/oidcMockServer.ts`.
const campaignerEmail = 'e2e-campaigner@example.com'
const citizenEmail = `e2e-campaigner-citizen-${run}@example.com`
const citizenPseudo = `Alix ${run}`
const admin = { email: `e2e-campaigner-admin-${run}@example.com`, password: 'test' }

const signedInText = `Connecté·e en tant que Camille Martin (${campaignerEmail})`

const campaignerLoginAndLogout = async (page: Page, baseURL: string) => {
  await page.goto('/fr/dashboard')
  await expect(page).toHaveURL('/fr/dashboard', { timeout: 30000 })
  await expect(page.getByText(signedInText)).toBeVisible({ timeout: 15000 })
  await expect(
    page.getByText("Votre compte n'est rattaché à aucune organisation pour le moment."),
  ).toBeVisible()

  // The provider sends the browser to `/`, which next.config.ts redirects on to `/fr`.
  const landing = page.waitForRequest(new URL('/', baseURL).href)
  await page.getByRole('button', { name: 'Se déconnecter du tableau de bord' }).click()
  await landing
  await expect(page).toHaveURL('/fr', { timeout: 15000 })
}

test.describe('Campaigner dashboard', () => {
  test.beforeAll(async () => {
    const payload = await getPayload({ config })
    await payload.delete({ collection: 'admins', where: { email: { equals: admin.email } } })
    await payload.create({ collection: 'admins', data: admin })
  })

  test.afterAll(async () => {
    const payload = await getPayload({ config })
    await payload.delete({
      collection: 'campaigners',
      where: { email: { equals: campaignerEmail } },
    })
    await payload.delete({ collection: 'admins', where: { email: { equals: admin.email } } })
    await payload.delete({ collection: 'citizens', where: { email: { equals: citizenEmail } } })
    await payload.delete({ collection: 'magic-links', where: { email: { equals: citizenEmail } } })
  })

  test('signs in through the provider, shows the campaigner, and logs out', async ({
    page,
    context,
    baseURL,
  }) => {
    await campaignerLoginAndLogout(page, baseURL!)

    const cookies = await context.cookies()
    expect(cookies.find((cookie) => cookie.name === 'campaigner-token')).toBeUndefined()

    const authorize = page.waitForRequest('**/api/campaigners/oidc/authorize**')
    await page.goto('/fr/dashboard')
    await authorize
    await expect(page.getByText(signedInText)).toBeVisible({ timeout: 15000 })
  })

  test('shows the login error and a retry link without navigating', async ({ page }) => {
    await page.goto('/fr/dashboard/login?error=access-denied')

    await expect(page.getByText("Votre compte n'a pas accès à mobibi.")).toBeVisible({
      timeout: 30000,
    })
    const retry = page.getByRole('link', { name: 'Réessayer' })
    await expect(retry).toHaveAttribute(
      'href',
      '/api/campaigners/oidc/authorize?returnTo=%2Ffr%2Fdashboard',
    )

    await page.waitForTimeout(1000)
    await expect(page).toHaveURL('/fr/dashboard/login?error=access-denied')
  })

  test('an unknown error code shows the default message', async ({ page }) => {
    await page.goto('/fr/dashboard/login?error=nope')
    await expect(page.getByText('Une erreur est survenue pendant la connexion.')).toBeVisible({
      timeout: 30000,
    })
  })

  test('citizen and admin sessions survive a campaigner login and logout', async ({
    page,
    context,
    baseURL,
  }) => {
    // Three cold compiles under Turbopack dev (public site, admin panel, dashboard) in one test.
    test.slow()

    // Admin first: Payload runs the citizen strategy before its own JWT one, so once a citizen
    // is signed in, /admin/login sees a user and bounces to /admin/unauthorized.
    await login({ page, serverURL: baseURL, user: admin })

    const requested = await page.request.post('/api/citizens/magic-link', {
      data: { email: citizenEmail, pseudo: citizenPseudo, lang: 'fr' },
    })
    const { devToken } = await requested.json()
    expect(devToken).toBeTruthy()
    await page.goto(`/api/citizens/magic-link/verify?token=${devToken}&lang=fr`)
    await expect(page.getByText(citizenPseudo)).toBeVisible({ timeout: 15000 })

    await campaignerLoginAndLogout(page, baseURL!)

    await page.goto('/fr')
    await expect(page.getByText(citizenPseudo)).toBeVisible({ timeout: 15000 })

    // Same shadowing: the admin session is only visible once the citizen one is gone.
    await context.clearCookies({ name: 'citizen-token' })
    await page.goto('/admin')
    await expect(page).toHaveURL('/admin')
    await expect(page.locator('span[title="Dashboard"]').first()).toBeVisible({ timeout: 15000 })
  })
})
