import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { consumeMagicLink, createMagicLink } from '@/lib/magicLink'
import { createSubmission, readPendingSubmission } from '@/lib/submissions'
import config from '@/payload.config'

let payload: Payload
let req: PayloadRequest

/** Unique per run so repeated runs never collide on slugs or emails. */
const run = Date.now()

const orgSlug = `interpel-org-${run}`
const campaignSlug = `interpel-campaign-${run}`

let orgId: number
let campaignId: number
let targetId: number
let channelId: string
let citizenId: number

/** The two denormalised counters an interpellation moves, read straight back. */
const counters = async (): Promise<{ campaign: number; target: number }> => {
  const campaign = await payload.findByID({
    collection: 'interpellations',
    id: campaignId,
    depth: 0,
  })
  const target = await payload.findByID({
    collection: 'campaign-targets',
    id: targetId,
    depth: 0,
  })
  return { campaign: campaign.submissionCount ?? 0, target: target.submissionCount ?? 0 }
}

const pending = () => ({
  targetId,
  campaignId,
  channelId,
  channelType: 'email',
})

describe('interpellation submitting', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    req = await createLocalReq({}, payload)

    const org = await payload.create({
      collection: 'organizations',
      data: { name: `Interpel org ${run}`, slug: orgSlug },
    })
    orgId = org.id

    const campaign = await payload.create({
      collection: 'interpellations',
      data: {
        organization: orgId,
        slug: campaignSlug,
        status: 'active',
        title: 'Campagne à relayer',
        defaultMessages: [{ channelType: 'email', subject: 'Objet', body: 'Bonjour {lastName},' }],
      },
    })
    campaignId = campaign.id

    const target = await payload.create({
      collection: 'campaign-targets',
      data: {
        campaign: campaignId,
        firstName: 'Alix',
        lastName: 'Dupont',
        role: 'Sénatrice',
        channels: [
          {
            type: 'email',
            value: 'alix@example.com',
            feedbackFields: [{ label: "Comment s'est passé l'échange ?" }],
          },
        ],
      },
    })
    targetId = target.id
    channelId = target.channels?.[0]?.id ?? ''
  })

  afterAll(async () => {
    await payload.delete({
      collection: 'interpellation-submissions',
      where: { campaign: { equals: campaignId } },
    })
    await payload.delete({
      collection: 'citizens',
      where: { email: { contains: `interpel-${run}` } },
    })
    await payload.delete({
      collection: 'magic-links',
      where: { email: { contains: `interpel-${run}` } },
    })
    await payload.delete({ collection: 'campaign-targets', id: targetId })
    await payload.delete({ collection: 'interpellations', id: campaignId })
    await payload.delete({ collection: 'organizations', id: orgId })
  })

  it('writes the channel and feedback snapshot, and bumps both counters', async () => {
    const citizen = await payload.create({
      collection: 'citizens',
      data: { email: `interpel-${run}-a@example.com`, pseudo: 'Alex', emailVerified: true },
    })
    citizenId = citizen.id

    const before = await counters()

    await createSubmission(req, citizenId, {
      ...pending(),
      feedback: [{ label: "Comment s'est passé l'échange ?", value: 'Réponse polie.' }],
    })

    expect(await counters()).toEqual({ campaign: before.campaign + 1, target: before.target + 1 })

    const { docs } = await payload.find({
      collection: 'interpellation-submissions',
      where: { and: [{ target: { equals: targetId } }, { citizen: { equals: citizenId } }] },
      limit: 1,
    })
    expect(docs[0].channelId).toBe(channelId)
    expect(docs[0].channelType).toBe('email')
    expect(docs[0].feedback?.[0]).toMatchObject({
      label: "Comment s'est passé l'échange ?",
      value: 'Réponse polie.',
    })
  })

  // The decision worth pinning: unlike a signature, the same (citizen, target,
  // channel) may be submitted again, and the counter counts submissions.
  it('accepts a repeat submission for the same citizen, target and channel', async () => {
    const before = await counters()

    await createSubmission(req, citizenId, pending())

    expect(await counters()).toEqual({ campaign: before.campaign + 1, target: before.target + 1 })
    const { totalDocs } = await payload.count({
      collection: 'interpellation-submissions',
      where: { and: [{ target: { equals: targetId } }, { citizen: { equals: citizenId } }] },
    })
    expect(totalDocs).toBe(2)
  })

  it('an interpellation magic link creates the citizen, the submission, and lands on the campaign', async () => {
    const email = `interpel-${run}-b@example.com`
    const before = await counters()

    const { rawToken } = await createMagicLink(req, {
      email,
      pseudo: 'Camille',
      lang: 'fr',
      intent: {
        type: 'interpellation-submission',
        payload: { ...pending(), feedback: [{ label: 'Retour', value: 'Rien à signaler.' }] },
      },
    })

    const result = await consumeMagicLink(req, rawToken)
    expect(result).not.toBeNull()
    expect(result!.citizen.email).toBe(email)
    expect(result!.citizen.emailVerified).toBe(true)
    // Built from the campaign's own slugs, never from the verify request.
    expect(result!.redirectTo).toBe(`/fr/${orgSlug}/${campaignSlug}`)

    expect(await counters()).toEqual({ campaign: before.campaign + 1, target: before.target + 1 })

    const { docs } = await payload.find({
      collection: 'interpellation-submissions',
      where: { citizen: { equals: result!.citizen.id } },
      limit: 1,
    })
    expect(docs[0].feedback?.[0]).toMatchObject({ label: 'Retour', value: 'Rien à signaler.' })
  })

  it('replaying the same token does not count twice', async () => {
    const email = `interpel-${run}-c@example.com`

    const { rawToken } = await createMagicLink(req, {
      email,
      pseudo: 'Dominique',
      lang: 'fr',
      intent: { type: 'interpellation-submission', payload: pending() },
    })

    await consumeMagicLink(req, rawToken)
    const after = await counters()

    // The single-use claim is what stops one click counting twice — the second
    // call must perform no write at all, not just skip the session.
    expect(await consumeMagicLink(req, rawToken)).toBeNull()
    expect(await counters()).toEqual(after)
  })

  it('propagates a real write failure instead of redirecting to a thank-you', async () => {
    const email = `interpel-${run}-d@example.com`

    // A target id that does not exist: the relationship validation fails.
    // Redemption must throw rather than send the citizen to a « merci » page
    // for a submission that was never written.
    const { rawToken } = await createMagicLink(req, {
      email,
      pseudo: 'Alix',
      lang: 'fr',
      intent: {
        type: 'interpellation-submission',
        payload: { ...pending(), targetId: 99_999_999 },
      },
    })

    await expect(consumeMagicLink(req, rawToken)).rejects.toThrow()
  })

  it('a malformed intent payload is skipped rather than thrown on', () => {
    expect(readPendingSubmission(null)).toBeNull()
    expect(readPendingSubmission({ targetId: 'nope' })).toBeNull()
    // Present but incomplete: the channel snapshot is not optional.
    expect(readPendingSubmission({ targetId: 1, campaignId: 2 })).toBeNull()
    expect(
      readPendingSubmission({ targetId: 1, campaignId: 2, channelId: 'a', channelType: 'email' }),
    ).toEqual({
      targetId: 1,
      campaignId: 2,
      channelId: 'a',
      channelType: 'email',
      feedback: undefined,
    })
  })
})
