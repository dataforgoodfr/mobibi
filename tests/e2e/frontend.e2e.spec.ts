import { test, expect } from '@playwright/test'

import {
  campaignFixture,
  cleanupCampaignFixture,
  seedCampaignFixture,
} from '../helpers/seedCampaign'

test.describe('Frontend', () => {
  test.beforeAll(async () => {
    await seedCampaignFixture()
  })

  test.afterAll(async () => {
    await cleanupCampaignFixture()
  })

  test('redirects the root to /fr', async ({ page }) => {
    await page.goto('http://localhost:3000/')
    await expect(page).toHaveURL('http://localhost:3000/fr')
  })

  test('lists the fixture campaigns on the home page', async ({ page }) => {
    await page.goto('http://localhost:3000/fr')
    await expect(
      page.getByRole('heading', { name: campaignFixture.interpellationTitle }),
    ).toBeVisible()
    await expect(page.getByRole('heading', { name: campaignFixture.petitionTitle })).toBeVisible()
  })

  test('the segmented filter narrows the list to petitions only', async ({ page }) => {
    await page.goto('http://localhost:3000/fr')
    await page.getByRole('button', { name: 'Pétitions' }).click()

    await expect(page.getByRole('heading', { name: campaignFixture.petitionTitle })).toBeVisible()
    await expect(
      page.getByRole('heading', { name: campaignFixture.interpellationTitle }),
    ).not.toBeVisible()
  })

  test('an unknown locale 404s', async ({ page }) => {
    const response = await page.goto('http://localhost:3000/xx')
    expect(response?.status()).toBe(404)
  })

  test('renders the campaign title and both targets', async ({ page }) => {
    await page.goto(
      `http://localhost:3000/fr/${campaignFixture.orgSlug}/${campaignFixture.interpellationSlug}`,
    )
    await expect(
      page.getByRole('heading', { name: campaignFixture.interpellationTitle }),
    ).toBeVisible()
    await expect(page.getByText(campaignFixture.targetOneName)).toBeVisible()
    await expect(page.getByText(campaignFixture.targetTwoName)).toBeVisible()
  })

  test('the search box narrows the target list', async ({ page }) => {
    await page.goto(
      `http://localhost:3000/fr/${campaignFixture.orgSlug}/${campaignFixture.interpellationSlug}`,
    )
    await page.getByLabel('Chercher une cible par nom, groupe ou département').fill('Alix')

    await expect(page.getByText(campaignFixture.targetOneName)).toBeVisible()
    await expect(page.getByText(campaignFixture.targetTwoName)).not.toBeVisible()
  })

  test('toggling "Plus sollicité·es" reverses the target order', async ({ page }) => {
    await page.goto(
      `http://localhost:3000/fr/${campaignFixture.orgSlug}/${campaignFixture.interpellationSlug}`,
    )
    const names = page.getByTestId('target-name')

    // Default sort is "moins sollicité·es": target one (0 submissions) first.
    await expect(names.first()).toHaveText(campaignFixture.targetOneName)

    await page.getByRole('button', { name: 'Plus sollicité·es' }).click()
    await expect(names.first()).toHaveText(campaignFixture.targetTwoName)
  })

  // Runs after the sort assertion above, and moves both targets' counters —
  // the file's tests are serial, so nothing else reads them afterwards.
  test('an anonymous visitor interpellates, confirms by magic link, then declares again signed in', async ({
    page,
  }) => {
    const campaignURL = `http://localhost:3000/fr/${campaignFixture.orgSlug}/${campaignFixture.interpellationSlug}`
    const search = () => page.getByLabel('Chercher une cible par nom, groupe ou département')
    const card = (name: string) => page.getByTestId('target-card').filter({ hasText: name })

    await page.goto(campaignURL)

    // Target two carries two channels, so the flow opens on the choice step.
    await search().fill('Bao')
    await card(campaignFixture.targetTwoName).getByRole('button', { name: 'Interpeller' }).click()
    await expect(page.getByText("Comment l'interpeller ?")).toBeVisible()
    await page.getByRole('button', { name: 'Twitter / X' }).click()

    // The campaign's twitter default message, with {handle} filled in.
    await expect(page.getByText('Bonjour @bao,')).toBeVisible()
    // The outline button, not the deep link — that one opens a new tab.
    await page.getByRole('button', { name: "J'ai interpellé" }).click()

    await page.getByPlaceholder('prenom@email.fr').fill(campaignFixture.interpellerEmail)
    await page.getByPlaceholder("Comment t'appeler").fill(campaignFixture.interpellerPseudo)

    // Same `devToken` shortcut as the signing test: never present outside
    // dev/test, and it lets the test click the link a real inbox would.
    const declareResponse = page.waitForResponse('**/interpellate')
    await page.getByRole('button', { name: 'Valider — recevoir mon lien' }).click()
    const { status, devToken } = await (await declareResponse).json()
    expect(status).toBe('link-sent')
    expect(devToken).toBeTruthy()

    // Nothing counted yet — the submission only lands when the link is clicked.
    await expect(page.getByText('Clique sur le lien envoyé à')).toBeVisible()
    const count = (name: string) => card(name).getByTestId('target-count')
    await expect(count(campaignFixture.targetTwoName)).toHaveText('1')
    // Anonymous: no personal history to show, on the card or in the header.
    await expect(page.getByTestId('target-done')).toHaveCount(0)
    await expect(page.getByTestId('my-submission-count')).toHaveCount(0)

    await page.goto(
      `http://localhost:3000/api/citizens/magic-link/verify?token=${devToken}&lang=fr`,
    )

    // Redirected back to the campaign, target two's counter now moved.
    await expect(page).toHaveURL(campaignURL)
    await expect(page.getByTestId('my-submission-count')).toContainText('1 de toi')
    await search().fill('Bao')
    await expect(count(campaignFixture.targetTwoName)).toHaveText('2')
    // Signed in now: the card carries the citizen's own mark, and its CTA says
    // a repeat is welcome rather than repeating the first-time wording.
    await expect(card(campaignFixture.targetTwoName).getByTestId('target-done')).toBeVisible()
    await expect(
      card(campaignFixture.targetTwoName).getByRole('button', { name: 'Relancer' }),
    ).toBeVisible()

    // Still signed in, and target one has a single channel — so the flow skips
    // the choice step and opens straight on the message.
    await search().fill('Alix')
    await card(campaignFixture.targetOneName).getByRole('button', { name: 'Interpeller' }).click()
    await expect(page.getByText('Interpeller par email')).toBeVisible()
    await expect(page.getByText('alix@example.com')).toBeVisible()
    await page.getByRole('button', { name: "J'ai interpellé" }).click()

    // Signed in: the account supplies both, so neither field is asked for.
    await expect(page.getByPlaceholder('prenom@email.fr')).toHaveCount(0)
    // The channel's own feedback field, rendered from the campaign.
    await page.getByLabel(campaignFixture.feedbackLabel).fill(campaignFixture.feedbackAnswer)
    await page.getByRole('button', { name: "Valider — j'ai interpellé Alix" }).click()

    // The modal stays put while the citizen reads it — the page behind only
    // catches up when they close it.
    await expect(page.getByText("Merci, c'est compté")).toBeVisible()
    await expect(page).toHaveURL(campaignURL)

    await page.keyboard.press('Escape')
    await expect(page.getByText("Merci, c'est compté")).not.toBeVisible()
    // Refreshed on close: same output as the magic-link path, personal marks
    // included — the header now counts both of this citizen's messages.
    await expect(page.getByTestId('my-submission-count')).toContainText('2 de toi')
    await search().fill('Alix')
    await expect(count(campaignFixture.targetOneName)).toHaveText('1')
    await expect(card(campaignFixture.targetOneName).getByTestId('target-done')).toBeVisible()
  })

  test('renders the petition title, tier label and text', async ({ page }) => {
    await page.goto(
      `http://localhost:3000/fr/${campaignFixture.orgSlug}/${campaignFixture.petitionSlug}`,
    )
    await expect(page.getByRole('heading', { name: campaignFixture.petitionTitle })).toBeVisible()
    await expect(page.getByText(campaignFixture.petitionTierTwoLabel)).toBeVisible()
    await expect(page.getByText('Texte de la pétition.')).toBeVisible()
  })

  test('shows the signature count once the count-up settles, and the recent signature', async ({
    page,
  }) => {
    await page.goto(
      `http://localhost:3000/fr/${campaignFixture.orgSlug}/${campaignFixture.petitionSlug}`,
    )
    // Retries until the count-up animation lands on the final figure.
    await expect(page.getByTestId('petition-count')).toHaveText('1')
    await expect(page.getByText(campaignFixture.signatureCity)).toBeVisible()
  })

  // Runs after the count assertion above, and adds a signature of its own —
  // the file's tests are serial, so nothing else reads the count afterwards.
  test('an anonymous visitor signs, confirms by magic link, and comes back signed', async ({
    page,
  }) => {
    const petitionURL = `http://localhost:3000/fr/${campaignFixture.orgSlug}/${campaignFixture.petitionSlug}`
    await page.goto(petitionURL)

    await page.getByRole('button', { name: 'Je signe la pétition' }).click()
    await page.getByPlaceholder('prenom@email.fr').fill(campaignFixture.signerEmail)
    // Required: the pseudo is the only name a signature is ever shown under.
    await page
      .getByPlaceholder("Comment t'afficher dans la liste")
      .fill(campaignFixture.signerPseudo)
    await page.getByPlaceholder('Où tu signes depuis').fill(campaignFixture.signerCity)
    // The petition's own `additionalFields` entry, rendered from the campaign.
    await page
      .getByLabel(campaignFixture.petitionAdditionalFieldLabel)
      .fill(`35000 ${campaignFixture.signerCity}`)

    // Same `devToken` shortcut as `auth.e2e.spec.ts`: never present outside
    // dev/test, and it lets the test click the link a real inbox would.
    const signResponse = page.waitForResponse('**/sign')
    await page.getByRole('button', { name: 'Signer — recevoir mon lien' }).click()
    const { status, devToken } = await (await signResponse).json()
    expect(status).toBe('link-sent')
    expect(devToken).toBeTruthy()

    // Nothing is counted yet — the signature only lands when the link is clicked.
    await expect(page.getByText('Clique sur le lien envoyé à')).toBeVisible()

    await page.goto(
      `http://localhost:3000/api/citizens/magic-link/verify?token=${devToken}&lang=fr`,
    )

    // Redirected back to the plain petition URL — no « just signed » flag,
    // the page derives the whole confirmation from the signature itself.
    await expect(page).toHaveURL(petitionURL)
    await expect(page.getByText('Merci, ta signature compte.')).toBeVisible({ timeout: 15000 })
    await expect(page.getByTestId('petition-count')).toHaveText('2')
    await expect(page.getByText(campaignFixture.signerCity).first()).toBeVisible()

    // Being a pure function of the signature, that state survives a reload.
    await page.goto(petitionURL)
    await expect(page.getByText('Merci, ta signature compte.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Tu as signé' }).first()).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Je signe la pétition' })).not.toBeVisible()

    // Still signed in: the second petition takes the other branch — the
    // signature is written on submit, no link to click.
    const secondPetitionURL = `http://localhost:3000/fr/${campaignFixture.orgSlug}/${campaignFixture.secondPetitionSlug}`
    await page.goto(secondPetitionURL)
    await page.getByRole('button', { name: 'Je signe la pétition' }).click()
    // Both come from the account: shown so the citizen sees what their
    // signature will carry, neither editable here.
    await expect(page.getByPlaceholder('prenom@email.fr')).toBeDisabled()
    const pseudoField = page.getByPlaceholder("Comment t'afficher dans la liste")
    await expect(pseudoField).toBeDisabled()
    await expect(pseudoField).toHaveValue(campaignFixture.signerPseudo)
    await page.getByRole('button', { name: 'Signer maintenant' }).click()

    // The modal stays put while the citizen reads it — the page behind only
    // catches up when they close it.
    await expect(page.getByText("C'est signé. Merci")).toBeVisible()
    await expect(page).toHaveURL(secondPetitionURL)

    await page.keyboard.press('Escape')
    await expect(page.getByText("C'est signé. Merci")).not.toBeVisible()
    // Refreshed on close: same output as the magic-link path, no query flag.
    await expect(page.getByText('Merci, ta signature compte.')).toBeVisible()
    await expect(page.getByTestId('petition-count')).toHaveText('1')
    await expect(page.getByRole('button', { name: 'Tu as signé' }).first()).toBeDisabled()
    // The pseudo chosen at signup labels the signature in the public list and
    // the citizen menu in the nav — one name, set once.
    await expect(page.getByRole('listitem').getByText(campaignFixture.signerPseudo)).toBeVisible()
    await expect(page.getByRole('navigation').getByText(campaignFixture.signerPseudo)).toBeVisible()
  })

  test('an unknown organization or slug 404s', async ({ page }) => {
    const response = await page.goto(
      `http://localhost:3000/fr/${campaignFixture.orgSlug}/does-not-exist`,
    )
    expect(response?.status()).toBe(404)
  })

  test('a draft campaign 404s', async ({ page }) => {
    const response = await page.goto(
      `http://localhost:3000/fr/${campaignFixture.orgSlug}/${campaignFixture.draftInterpellationSlug}`,
    )
    expect(response?.status()).toBe(404)
  })

  test('the organization page renders its name, description and campaigns', async ({ page }) => {
    await page.goto(`http://localhost:3000/fr/${campaignFixture.orgSlug}`)
    await expect(page.getByRole('heading', { name: campaignFixture.orgName })).toBeVisible()
    await expect(page.getByText(campaignFixture.orgDescription)).toBeVisible()
    await expect(
      page.getByRole('heading', { name: campaignFixture.interpellationTitle }),
    ).toBeVisible()
    await expect(page.getByRole('heading', { name: campaignFixture.petitionTitle })).toBeVisible()
  })

  test('an unknown organization slug 404s', async ({ page }) => {
    const response = await page.goto('http://localhost:3000/fr/does-not-exist')
    expect(response?.status()).toBe(404)
  })

  test("the campaign detail page's breadcrumb links back to the organization page", async ({
    page,
  }) => {
    await page.goto(
      `http://localhost:3000/fr/${campaignFixture.orgSlug}/${campaignFixture.interpellationSlug}`,
    )
    await page.getByRole('link', { name: campaignFixture.orgName }).click()
    await expect(page).toHaveURL(`http://localhost:3000/fr/${campaignFixture.orgSlug}`)
    await expect(page.getByRole('heading', { name: campaignFixture.orgName })).toBeVisible()
  })
})
