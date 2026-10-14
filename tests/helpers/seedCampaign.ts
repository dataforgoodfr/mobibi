import { getPayload } from 'payload'

import config from '@/payload.config'

/** Unique per run so repeated e2e runs never collide on slugs. */
const run = Date.now()

export const campaignFixture = {
  orgSlug: `e2e-org-${run}`,
  orgName: `E2E org ${run}`,
  orgDescription: `Description de test ${run}.`,
  interpellationSlug: `e2e-interpellation-${run}`,
  interpellationTitle: `E2E interpellation ${run}`,
  petitionSlug: `e2e-petition-${run}`,
  petitionTitle: `E2E petition ${run}`,
  /** A second petition, so the signing test can exercise both paths: the
   *  magic-link one on the first, then the direct write on this one while
   *  still signed in. */
  secondPetitionSlug: `e2e-petition-2-${run}`,
  secondPetitionTitle: `E2E petition 2 ${run}`,
  draftInterpellationSlug: `e2e-draft-interpellation-${run}`,
  draftInterpellationTitle: `E2E draft interpellation ${run}`,
  targetOneName: `Alix Dupont ${run}`,
  targetTwoName: `Bao Nguyen ${run}`,
  timelineCurrentLabel: `Vote en commission ${run}`,
  petitionTierTwoLabel: `On accélère ${run}`,
  signatureCity: `Lyon ${run}`,
  petitionAdditionalFieldLabel: `Code postal ${run}`,
  /** The address the signing test signs with — cleaned up by pattern below. */
  signerEmail: `e2e-signer-${run}@example.com`,
  signerCity: `Rennes ${run}`,
  /** Chosen at signup — `citizens.pseudo` is required, so it always exists. */
  signerPseudo: `Camille ${run}`,
  /** The address the interpellation test declares with. */
  interpellerEmail: `e2e-interpeller-${run}@example.com`,
  interpellerPseudo: `Dominique ${run}`,
  /** On target one's email channel — the label the flow must snapshot. */
  feedbackLabel: `Comment ça s'est passé ${run}`,
  feedbackAnswer: `Réponse polie ${run}`,
}

let orgId: number | undefined
let interpellationId: number | undefined
let draftInterpellationId: number | undefined
let petitionId: number | undefined
let secondPetitionId: number | undefined
let targetOneId: number | undefined
let targetTwoId: number | undefined
let citizenId: number | undefined

/**
 * Seeds one organization with one active interpellation (a full fixture:
 * timeline, context, a default email message, and two targets) plus one
 * active petition and one draft interpellation (for the draft-404 guard).
 */
export async function seedCampaignFixture(): Promise<void> {
  const payload = await getPayload({ config })

  const org = await payload.create({
    collection: 'organizations',
    data: {
      name: campaignFixture.orgName,
      slug: campaignFixture.orgSlug,
      shortName: 'EO',
      description: campaignFixture.orgDescription,
    },
  })
  orgId = org.id

  const interpellation = await payload.create({
    collection: 'interpellations',
    data: {
      organization: orgId,
      slug: campaignFixture.interpellationSlug,
      status: 'active',
      title: campaignFixture.interpellationTitle,
      context: {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [{ type: 'text', text: 'Contexte de test.', version: 1 }],
              version: 1,
            },
          ],
          direction: 'ltr',
          format: '',
          indent: 0,
          version: 1,
        },
      },
      timeline: [
        { label: 'Lancement', dateLabel: 'Jan. 2026', state: 'done' },
        { label: campaignFixture.timelineCurrentLabel, dateLabel: 'Mars 2026', state: 'current' },
        { label: 'Vote final', dateLabel: 'Juin 2026', state: 'upcoming' },
      ],
      defaultMessages: [
        { channelType: 'email', subject: 'Objet', body: 'Bonjour {lastName},' },
        { channelType: 'twitter', body: 'Bonjour @{handle},' },
      ],
    },
  })
  interpellationId = interpellation.id

  const draftInterpellation = await payload.create({
    collection: 'interpellations',
    data: {
      organization: orgId,
      slug: campaignFixture.draftInterpellationSlug,
      status: 'draft',
      title: campaignFixture.draftInterpellationTitle,
    },
  })
  draftInterpellationId = draftInterpellation.id

  const targetOne = await payload.create({
    collection: 'campaign-targets',
    data: {
      campaign: interpellationId,
      firstName: 'Alix',
      lastName: `Dupont ${run}`,
      role: 'Sénatrice',
      politicalGroup: 'UC',
      // One channel only: the interpeller modal skips its channel step here,
      // and the feedback field gives the declaration form something to snapshot.
      channels: [
        {
          type: 'email',
          value: 'alix@example.com',
          feedbackFields: [{ label: campaignFixture.feedbackLabel }],
        },
      ],
    },
  })
  targetOneId = targetOne.id

  const targetTwo = await payload.create({
    collection: 'campaign-targets',
    data: {
      campaign: interpellationId,
      firstName: 'Bao',
      lastName: `Nguyen ${run}`,
      role: 'Député',
      politicalGroup: 'RE',
      channels: [
        { type: 'email', value: 'bao@example.com' },
        { type: 'twitter', value: '@bao' },
      ],
    },
  })
  targetTwoId = targetTwo.id

  const petition = await payload.create({
    collection: 'petitions',
    data: {
      organization: orgId,
      slug: campaignFixture.petitionSlug,
      status: 'active',
      title: campaignFixture.petitionTitle,
      text: {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [{ type: 'text', text: 'Texte de la pétition.', version: 1 }],
              version: 1,
            },
          ],
          direction: 'ltr',
          format: '',
          indent: 0,
          version: 1,
        },
      },
      tiers: [
        { threshold: 1000, label: 'On démarre' },
        { threshold: 5000, label: campaignFixture.petitionTierTwoLabel },
      ],
      additionalFields: [{ label: campaignFixture.petitionAdditionalFieldLabel, required: false }],
    },
  })
  petitionId = petition.id

  const secondPetition = await payload.create({
    collection: 'petitions',
    data: {
      organization: orgId,
      slug: campaignFixture.secondPetitionSlug,
      status: 'active',
      title: campaignFixture.secondPetitionTitle,
      tiers: [{ threshold: 1000, label: 'On démarre' }],
    },
  })
  secondPetitionId = secondPetition.id

  // Bumps target two's submissionCount to 1 (via the counters hook) so the
  // list has a real difference to sort on — cheaper than asserting the
  // toggle's output order without any actual numbers behind it.
  const citizen = await payload.create({
    collection: 'citizens',
    data: { email: `e2e-citizen-${run}@example.com`, pseudo: `Seed signer ${run}` },
  })
  citizenId = citizen.id

  await payload.create({
    collection: 'interpellation-submissions',
    data: {
      citizen: citizenId,
      target: targetTwoId,
      campaign: interpellationId,
      channelId: targetTwo.channels?.[0]?.id ?? '',
      channelType: 'email',
    },
  })

  // signatureCount has `access: { update: () => false }` — it can only move
  // through the counters hook, so a real signature is created rather than
  // setting the number directly.
  await payload.create({
    collection: 'petition-signatures',
    data: { citizen: citizenId, petition: petitionId, city: campaignFixture.signatureCity },
  })
}

/** Deletes everything `seedCampaignFixture` created. */
export async function cleanupCampaignFixture(): Promise<void> {
  const payload = await getPayload({ config })

  // By campaign, not by id: the interpellation test declares submissions of
  // its own, and a target cannot be deleted while any still point at it.
  if (interpellationId) {
    await payload.delete({
      collection: 'interpellation-submissions',
      where: { campaign: { equals: interpellationId } },
    })
  }
  // By petition, not by id: the signing test adds signatures of its own, and
  // a petition cannot be deleted with signatures still pointing at it.
  const signedPetitions = [petitionId, secondPetitionId].filter(
    (id): id is number => id !== undefined,
  )
  if (signedPetitions.length > 0) {
    await payload.delete({
      collection: 'petition-signatures',
      where: { petition: { in: signedPetitions } },
    })
  }
  if (citizenId) {
    await payload.delete({ collection: 'citizens', id: citizenId })
  }
  // The citizens the signing and interpellation tests created by clicking
  // their magic links, plus the links themselves.
  const flowEmails = [campaignFixture.signerEmail, campaignFixture.interpellerEmail]
  await payload.delete({ collection: 'citizens', where: { email: { in: flowEmails } } })
  await payload.delete({ collection: 'magic-links', where: { email: { in: flowEmails } } })
  // Targets before the campaign: `campaign-targets` blocks deleting a target
  // with submissions, and the campaign relationship must still resolve.
  if (targetOneId) {
    await payload.delete({ collection: 'campaign-targets', id: targetOneId })
  }
  if (targetTwoId) {
    await payload.delete({ collection: 'campaign-targets', id: targetTwoId })
  }
  if (interpellationId) {
    await payload.delete({ collection: 'interpellations', id: interpellationId })
  }
  if (draftInterpellationId) {
    await payload.delete({ collection: 'interpellations', id: draftInterpellationId })
  }
  if (petitionId) {
    await payload.delete({ collection: 'petitions', id: petitionId })
  }
  if (secondPetitionId) {
    await payload.delete({ collection: 'petitions', id: secondPetitionId })
  }
  if (orgId) {
    await payload.delete({ collection: 'organizations', id: orgId })
  }
}
