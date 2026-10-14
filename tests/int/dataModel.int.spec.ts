import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { resolveTarget } from '@/lib/resolveTarget'

let payload: Payload

/** Unique per run so repeated runs never collide on slugs or emails. */
const run = Date.now()

/**
 * A ValidationError's top-level `message` is generic ("The following field is
 * invalid: slug"); the message our hook wrote lives in `data.errors[]`.
 */
const fieldError = (error: unknown, path: string, message: RegExp): boolean => {
  const errors = (error as { data?: { errors?: { path: string; message: string }[] } })?.data
    ?.errors
  return Boolean(errors?.some((e) => e.path === path && message.test(e.message)))
}

let orgId: number
let campaignId: number
let targetId: number
let petitionId: number
let citizenAId: number
let citizenBId: number

describe('data model', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })

    const org = await payload.create({
      collection: 'organizations',
      data: { name: `Test org ${run}`, slug: `test-org-${run}` },
    })
    orgId = org.id

    const campaign = await payload.create({
      collection: 'interpellations',
      data: {
        organization: orgId,
        slug: `test-campaign-${run}`,
        status: 'active',
        title: 'Campagne de test',
        defaultMessages: [
          { channelType: 'email', subject: 'Objet par défaut', body: 'Bonjour {lastName},' },
          { channelType: 'twitter', body: '@{handle} on vous regarde' },
        ],
      },
    })
    campaignId = campaign.id

    const target = await payload.create({
      collection: 'campaign-targets',
      data: {
        campaign: campaignId,
        firstName: 'Amel',
        lastName: 'Gacquerre',
        role: 'Sénatrice',
        politicalGroup: 'UC',
        district: 'Loire-Atlantique',
        externalRef: `amelgacquerre-${run}`,
        channels: [
          {
            type: 'email',
            value: 'a.gacquerre@exemple.fr',
            feedbackFields: [{ label: "Comment s'est passé l'échange ?" }],
          },
          { type: 'twitter', value: '@a_gacquerre' },
        ],
      },
    })
    targetId = target.id

    const petition = await payload.create({
      collection: 'petitions',
      data: {
        organization: orgId,
        slug: `test-petition-${run}`,
        status: 'active',
        title: 'Pétition de test',
        tiers: [{ threshold: 100, label: 'On démarre' }],
      },
    })
    petitionId = petition.id

    const [a, b] = await Promise.all([
      payload.create({
        collection: 'citizens',
        data: { email: `a-${run}@exemple.fr`, pseudo: 'A' },
      }),
      payload.create({
        collection: 'citizens',
        data: { email: `b-${run}@exemple.fr`, pseudo: 'B' },
      }),
    ])
    citizenAId = a.id
    citizenBId = b.id
  })

  afterAll(async () => {
    // Submissions first: the target refuses to be deleted while any exist.
    await payload.delete({
      collection: 'interpellation-submissions',
      where: { campaign: { equals: campaignId } },
    })
    await payload.delete({
      collection: 'petition-signatures',
      where: { petition: { equals: petitionId } },
    })
    await payload.delete({
      collection: 'campaign-targets',
      where: { campaign: { equals: campaignId } },
    })
    await payload.delete({ collection: 'interpellations', where: { id: { equals: campaignId } } })
    await payload.delete({ collection: 'petitions', where: { id: { equals: petitionId } } })
    await payload.delete({
      collection: 'citizens',
      where: { id: { in: [citizenAId, citizenBId] } },
    })
    await payload.delete({ collection: 'organizations', where: { id: { equals: orgId } } })
  })

  const createSubmission = (citizen: number) =>
    payload.create({
      collection: 'interpellation-submissions',
      data: {
        citizen,
        target: targetId,
        campaign: campaignId,
        channelId: 'channel-1',
        channelType: 'email',
        feedback: [{ label: "Comment s'est passé l'échange ?", value: 'Bien' }],
      },
    })

  it('increments the target counter and the campaign total on submission', async () => {
    const submission = await createSubmission(citizenAId)

    const target = await payload.findByID({ collection: 'campaign-targets', id: targetId })
    const campaign = await payload.findByID({ collection: 'interpellations', id: campaignId })

    expect(target.submissionCount).toBe(1)
    expect(campaign.submissionCount).toBe(1)

    await payload.delete({ collection: 'interpellation-submissions', id: submission.id })

    const afterDelete = await payload.findByID({ collection: 'campaign-targets', id: targetId })
    expect(afterDelete.submissionCount).toBe(0)
  })

  it('counts concurrent submissions exactly once each', async () => {
    // The regression this guards: a read-modify-write increment
    // (`count: doc.count + 1`) loses one of two simultaneous writes.
    await Promise.all([
      createSubmission(citizenAId),
      createSubmission(citizenBId),
      createSubmission(citizenAId),
      createSubmission(citizenBId),
    ])

    const target = await payload.findByID({ collection: 'campaign-targets', id: targetId })
    expect(target.submissionCount).toBe(4)
  })

  it('allows repeated submissions for the same citizen, target and channel', async () => {
    const { totalDocs } = await payload.count({
      collection: 'interpellation-submissions',
      where: { and: [{ target: { equals: targetId } }, { citizen: { equals: citizenAId } }] },
    })

    expect(totalDocs).toBeGreaterThan(1)
  })

  it('refuses to delete a target that has submissions', async () => {
    await expect(payload.delete({ collection: 'campaign-targets', id: targetId })).rejects.toThrow(
      /cannot be deleted/,
    )
  })

  it('sorts targets least-solicited first', async () => {
    const quiet = await payload.create({
      collection: 'campaign-targets',
      data: {
        campaign: campaignId,
        firstName: 'Bruno',
        lastName: 'Vasseur',
        role: 'Député',
        externalRef: `brunovasseur-${run}`,
        channels: [{ type: 'email', value: 'b.vasseur@exemple.fr' }],
      },
    })

    const { docs } = await payload.find({
      collection: 'campaign-targets',
      where: { campaign: { equals: campaignId } },
      sort: 'submissionCount',
      depth: 0,
    })

    expect(docs[0].id).toBe(quiet.id)
    expect(docs[0].submissionCount).toBe(0)
  })

  it('accepts only one signature per citizen per petition', async () => {
    await payload.create({
      collection: 'petition-signatures',
      data: {
        citizen: citizenAId,
        petition: petitionId,
        city: 'Rennes',
        responses: [{ label: 'Code postal', value: '35000' }],
      },
    })

    await expect(
      payload.create({
        collection: 'petition-signatures',
        data: { citizen: citizenAId, petition: petitionId },
      }),
    ).rejects.toSatisfy((error) => fieldError(error, 'citizen', /already signed/))

    const petition = await payload.findByID({ collection: 'petitions', id: petitionId })
    expect(petition.signatureCount).toBe(1)
  })

  it('rejects a slug already used by the other campaign type in the same organization', async () => {
    await expect(
      payload.create({
        collection: 'petitions',
        data: {
          organization: orgId,
          // Already taken by the interpellation — /:org/:slug must resolve to one.
          slug: `test-campaign-${run}`,
          status: 'draft',
          title: 'Collision',
        },
      }),
    ).rejects.toSatisfy((error) => fieldError(error, 'slug', /already used/))
  })

  it('allows the same slug under a different organization', async () => {
    const other = await payload.create({
      collection: 'organizations',
      data: { name: `Other org ${run}`, slug: `other-org-${run}` },
    })

    const ok = await payload.create({
      collection: 'petitions',
      data: {
        organization: other.id,
        slug: `test-campaign-${run}`,
        status: 'draft',
        title: 'Pas de collision',
      },
    })

    expect(ok.slug).toBe(`test-campaign-${run}`)

    await payload.delete({ collection: 'petitions', id: ok.id })
    await payload.delete({ collection: 'organizations', id: other.id })
  })

  it('generates a slug from the title when none is given', async () => {
    const doc = await payload.create({
      collection: 'petitions',
      // `slug` is omitted on purpose — the field hook derives it. It stays
      // `required` in the config (and so in the generated type) because the
      // column is NOT NULL once the hook has run.
      data: {
        organization: orgId,
        status: 'draft',
        title: `Élevages : c'est fini ${run}`,
      } as never,
    })

    expect(doc.slug).toBe(`elevages-c-est-fini-${run}`)
    await payload.delete({ collection: 'petitions', id: doc.id })
  })

  it('falls back to the default locale when a translation is missing', async () => {
    const fr = await payload.findByID({
      collection: 'interpellations',
      id: campaignId,
      locale: 'fr',
    })
    const en = await payload.findByID({
      collection: 'interpellations',
      id: campaignId,
      locale: 'en',
    })

    expect(fr.title).toBe('Campagne de test')
    expect(en.title).toBe('Campagne de test')

    await payload.update({
      collection: 'interpellations',
      id: campaignId,
      locale: 'en',
      data: { title: 'Test campaign' },
    })

    const translated = await payload.findByID({
      collection: 'interpellations',
      id: campaignId,
      locale: 'en',
    })
    const stillFrench = await payload.findByID({
      collection: 'interpellations',
      id: campaignId,
      locale: 'fr',
    })

    expect(translated.title).toBe('Test campaign')
    expect(stillFrench.title).toBe('Campagne de test')
  })

  it('lets a translator save one locale without retyping the mandatory fields', async () => {
    // Regression: `required: true` on a localized field means "required in every
    // locale", so this update used to fail on the untranslated message bodies.
    const updated = await payload.update({
      collection: 'interpellations',
      id: campaignId,
      locale: 'en',
      data: { tagline: 'Write to your MP — it takes two minutes.' },
    })

    expect(updated.tagline).toBe('Write to your MP — it takes two minutes.')
  })

  it('still demands a title in the default locale', async () => {
    await expect(
      payload.create({
        collection: 'interpellations',
        data: { organization: orgId, slug: `no-title-${run}`, status: 'draft' },
      }),
    ).rejects.toSatisfy((error) => fieldError(error, 'title', /required/i))
  })

  it('hides draft campaigns from the public but not from admins', async () => {
    const draft = await payload.create({
      collection: 'interpellations',
      data: {
        organization: orgId,
        slug: `draft-campaign-${run}`,
        status: 'draft',
        title: 'Brouillon',
      },
    })

    const publicView = await payload.find({
      collection: 'interpellations',
      where: { id: { equals: draft.id } },
      overrideAccess: false,
    })
    expect(publicView.totalDocs).toBe(0)

    const adminView = await payload.find({
      collection: 'interpellations',
      where: { id: { equals: draft.id } },
    })
    expect(adminView.totalDocs).toBe(1)

    await payload.delete({ collection: 'interpellations', id: draft.id })
  })

  it('resolves channel messages, falling back to the campaign default', async () => {
    const target = await payload.findByID({ collection: 'campaign-targets', id: targetId })
    const campaign = await payload.findByID({ collection: 'interpellations', id: campaignId })

    const resolved = resolveTarget(target, campaign)

    expect(resolved.fullName).toBe('Amel Gacquerre')
    expect(resolved.initials).toBe('AG')

    const email = resolved.channels.find((channel) => channel.type === 'email')
    const twitter = resolved.channels.find((channel) => channel.type === 'twitter')

    // No per-target override → campaign default, with placeholders filled in.
    expect(email?.message).toBe('Bonjour Gacquerre,')
    expect(email?.subject).toBe('Objet par défaut')
    // The index is the position in the raw array — what the « j'ai interpellé »
    // form posts back for the server to look the label up by.
    expect(email?.feedbackFields).toEqual([{ index: 0, label: "Comment s'est passé l'échange ?" }])
    expect(twitter?.message).toBe('@a_gacquerre on vous regarde')
  })
})
