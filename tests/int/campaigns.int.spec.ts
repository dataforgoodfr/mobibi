import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { campaignTotals, getCampaign, listActiveCampaigns } from '@/lib/campaigns'
import { getOrganization } from '@/lib/organizations'
import config from '@/payload.config'

let payload: Payload

/** Unique per run so repeated runs never collide on slugs or emails. */
const run = Date.now()

let orgId: number
let activeInterpellationId: number
let activePetitionId: number
let draftInterpellationId: number
let archivedPetitionId: number
let otherOrgId: number
let otherOrgActiveInterpellationId: number

describe('listActiveCampaigns', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })

    const org = await payload.create({
      collection: 'organizations',
      data: { name: `Test org ${run}`, slug: `test-org-${run}` },
    })
    orgId = org.id

    const activeInterpellation = await payload.create({
      collection: 'interpellations',
      data: {
        organization: orgId,
        slug: `test-active-interpellation-${run}`,
        status: 'active',
        title: 'Campagne active',
      },
    })
    activeInterpellationId = activeInterpellation.id

    const activePetition = await payload.create({
      collection: 'petitions',
      data: {
        organization: orgId,
        slug: `test-active-petition-${run}`,
        status: 'active',
        title: 'Pétition active',
        tiers: [
          { threshold: 1000, label: 'On démarre' },
          { threshold: 5000, label: 'On y est' },
        ],
      },
    })
    activePetitionId = activePetition.id

    const draftInterpellation = await payload.create({
      collection: 'interpellations',
      data: {
        organization: orgId,
        slug: `test-draft-interpellation-${run}`,
        status: 'draft',
        title: 'Campagne brouillon',
      },
    })
    draftInterpellationId = draftInterpellation.id

    const archivedPetition = await payload.create({
      collection: 'petitions',
      data: {
        organization: orgId,
        slug: `test-archived-petition-${run}`,
        status: 'archived',
        title: 'Pétition archivée',
        tiers: [{ threshold: 1000, label: 'On démarre' }],
      },
    })
    archivedPetitionId = archivedPetition.id

    const otherOrg = await payload.create({
      collection: 'organizations',
      data: {
        name: `Other test org ${run}`,
        slug: `other-test-org-${run}`,
        shortName: 'OT',
        color: '#0f7a5a',
        description: 'Une autre organisation de test.',
      },
    })
    otherOrgId = otherOrg.id

    const otherOrgActiveInterpellation = await payload.create({
      collection: 'interpellations',
      data: {
        organization: otherOrgId,
        slug: `other-org-active-interpellation-${run}`,
        status: 'active',
        title: 'Campagne autre organisation',
      },
    })
    otherOrgActiveInterpellationId = otherOrgActiveInterpellation.id
  })

  afterAll(async () => {
    await payload.delete({
      collection: 'interpellations',
      where: { id: { in: [activeInterpellationId, draftInterpellationId] } },
    })
    await payload.delete({
      collection: 'petitions',
      where: { id: { in: [activePetitionId, archivedPetitionId] } },
    })
    await payload.delete({ collection: 'organizations', where: { id: { equals: orgId } } })
    await payload.delete({
      collection: 'interpellations',
      where: { id: { equals: otherOrgActiveInterpellationId } },
    })
    await payload.delete({ collection: 'organizations', where: { id: { equals: otherOrgId } } })
  })

  it('includes only active and upcoming campaigns, merged across both collections', async () => {
    const campaigns = await listActiveCampaigns(payload, 'fr')
    const ids = campaigns.map((c) => `${c.type}-${c.id}`)

    expect(ids).toContain(`interpellation-${activeInterpellationId}`)
    expect(ids).toContain(`petition-${activePetitionId}`)
    expect(ids).not.toContain(`interpellation-${draftInterpellationId}`)
    expect(ids).not.toContain(`petition-${archivedPetitionId}`)
  })

  it('resolves the organization and the next unmet tier', async () => {
    const campaigns = await listActiveCampaigns(payload, 'fr')
    const petition = campaigns.find(
      (c): c is typeof c & { type: 'petition' } =>
        c.type === 'petition' && c.id === activePetitionId,
    )

    expect(petition?.organization.slug).toBe(`test-org-${run}`)
    expect(petition?.count).toBe(0)
    expect(petition?.nextTier).toEqual({ threshold: 1000, label: 'On démarre' })
  })

  it('sums counts per campaign type for the home hero', async () => {
    const campaigns = await listActiveCampaigns(payload, 'fr')
    const totals = campaignTotals(campaigns)

    expect(totals.interpellations).toBeGreaterThanOrEqual(0)
    expect(totals.signatures).toBeGreaterThanOrEqual(0)
  })

  it('scopes to one organization when a slug is passed, excluding other orgs and drafts', async () => {
    const campaigns = await listActiveCampaigns(payload, 'fr', `test-org-${run}`)
    const ids = campaigns.map((c) => `${c.type}-${c.id}`)

    expect(ids).toContain(`interpellation-${activeInterpellationId}`)
    expect(ids).toContain(`petition-${activePetitionId}`)
    expect(ids).not.toContain(`interpellation-${draftInterpellationId}`)
    expect(ids).not.toContain(`interpellation-${otherOrgActiveInterpellationId}`)
  })
})

describe('getOrganization', () => {
  // Its own fixture, not `listActiveCampaigns`'s: that describe's `afterAll`
  // deletes its rows before this one's tests would run.
  let getOrganizationPayload: Payload
  let getOrganizationOrgId: number

  beforeAll(async () => {
    getOrganizationPayload = await getPayload({ config: await config })

    const org = await getOrganizationPayload.create({
      collection: 'organizations',
      data: {
        name: `Test org getOrganization ${run}`,
        slug: `test-org-getorganization-${run}`,
        shortName: 'OT',
        color: '#0f7a5a',
        description: 'Une organisation de test.',
      },
    })
    getOrganizationOrgId = org.id
  })

  afterAll(async () => {
    await getOrganizationPayload.delete({
      collection: 'organizations',
      where: { id: { equals: getOrganizationOrgId } },
    })
  })

  it('resolves an organization by slug, with description, shortName and color', async () => {
    const organization = await getOrganization(getOrganizationPayload, {
      slug: `test-org-getorganization-${run}`,
      locale: 'fr',
    })

    expect(organization).toMatchObject({
      name: `Test org getOrganization ${run}`,
      slug: `test-org-getorganization-${run}`,
      shortName: 'OT',
      color: '#0f7a5a',
      description: 'Une organisation de test.',
    })
  })

  it('returns null for an unknown slug', async () => {
    const organization = await getOrganization(getOrganizationPayload, {
      slug: 'does-not-exist',
      locale: 'fr',
    })

    expect(organization).toBeNull()
  })
})

describe('getCampaign', () => {
  // Its own fixture, not `listActiveCampaigns`'s: that describe's `afterAll`
  // deletes its rows before this one's tests would run.
  let getCampaignPayload: Payload
  let getCampaignOrgId: number
  let getCampaignInterpellationId: number
  let getCampaignDraftId: number
  let getCampaignTargetId: number
  let getCampaignPetitionId: number
  let getCampaignCitizenId: number
  let getCampaignSignatureId: number

  beforeAll(async () => {
    getCampaignPayload = await getPayload({ config: await config })

    const org = await getCampaignPayload.create({
      collection: 'organizations',
      data: { name: `Test org getCampaign ${run}`, slug: `test-org-getcampaign-${run}` },
    })
    getCampaignOrgId = org.id

    const interpellation = await getCampaignPayload.create({
      collection: 'interpellations',
      data: {
        organization: getCampaignOrgId,
        slug: `test-getcampaign-interpellation-${run}`,
        status: 'active',
        title: 'Campagne getCampaign',
        timeline: [{ label: 'Lancement', dateLabel: 'Jan. 2026', state: 'current' }],
      },
    })
    getCampaignInterpellationId = interpellation.id

    const target = await getCampaignPayload.create({
      collection: 'campaign-targets',
      data: {
        campaign: getCampaignInterpellationId,
        firstName: 'Alix',
        lastName: 'Dupont',
        role: 'Sénatrice',
        channels: [{ type: 'email', value: 'alix@example.com' }],
      },
    })
    getCampaignTargetId = target.id

    const draft = await getCampaignPayload.create({
      collection: 'interpellations',
      data: {
        organization: getCampaignOrgId,
        slug: `test-getcampaign-draft-${run}`,
        status: 'draft',
        title: 'Campagne getCampaign brouillon',
      },
    })
    getCampaignDraftId = draft.id

    const petition = await getCampaignPayload.create({
      collection: 'petitions',
      data: {
        organization: getCampaignOrgId,
        slug: `test-getcampaign-petition-${run}`,
        status: 'active',
        title: 'Pétition getCampaign',
        text: {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', text: 'Texte de test.', version: 1 }],
                version: 1,
              },
            ],
            direction: 'ltr',
            format: '',
            indent: 0,
            version: 1,
          },
        },
        tiers: [{ threshold: 1000, label: 'On démarre' }],
      },
    })
    getCampaignPetitionId = petition.id

    const citizen = await getCampaignPayload.create({
      collection: 'citizens',
      data: { email: `test-getcampaign-citizen-${run}@example.com`, pseudo: 'Sacha' },
    })
    getCampaignCitizenId = citizen.id

    const signature = await getCampaignPayload.create({
      collection: 'petition-signatures',
      data: { citizen: getCampaignCitizenId, petition: getCampaignPetitionId, city: 'Lyon' },
    })
    getCampaignSignatureId = signature.id
  })

  afterAll(async () => {
    await getCampaignPayload.delete({
      collection: 'campaign-targets',
      where: { id: { equals: getCampaignTargetId } },
    })
    await getCampaignPayload.delete({
      collection: 'interpellations',
      where: { id: { in: [getCampaignInterpellationId, getCampaignDraftId] } },
    })
    await getCampaignPayload.delete({
      collection: 'petition-signatures',
      where: { id: { equals: getCampaignSignatureId } },
    })
    await getCampaignPayload.delete({
      collection: 'citizens',
      where: { id: { equals: getCampaignCitizenId } },
    })
    await getCampaignPayload.delete({
      collection: 'petitions',
      where: { id: { equals: getCampaignPetitionId } },
    })
    await getCampaignPayload.delete({
      collection: 'organizations',
      where: { id: { equals: getCampaignOrgId } },
    })
  })

  it('resolves an interpellation by organization and slug, with timeline and targets', async () => {
    const campaign = await getCampaign(getCampaignPayload, {
      organization: `test-org-getcampaign-${run}`,
      slug: `test-getcampaign-interpellation-${run}`,
      locale: 'fr',
    })

    expect(campaign?.type).toBe('interpellation')
    if (campaign?.type !== 'interpellation') throw new Error('expected an interpellation')
    expect(campaign.title).toBe('Campagne getCampaign')
    expect(campaign.timeline).toEqual([
      { label: 'Lancement', dateLabel: 'Jan. 2026', state: 'current' },
    ])
    expect(campaign.targets).toHaveLength(1)
    expect(campaign.targets[0]).toMatchObject({
      fullName: 'Alix Dupont',
      role: 'Sénatrice',
      submissionCount: 0,
    })
    expect(campaign.targets[0].channels).toEqual([
      expect.objectContaining({ type: 'email', value: 'alix@example.com' }),
    ])
  })

  it('resolves a petition by organization and slug, with text, tiers and recent signatures', async () => {
    const campaign = await getCampaign(getCampaignPayload, {
      organization: `test-org-getcampaign-${run}`,
      slug: `test-getcampaign-petition-${run}`,
      locale: 'fr',
    })

    expect(campaign?.type).toBe('petition')
    if (campaign?.type !== 'petition') throw new Error('expected a petition')
    expect(campaign.title).toBe('Pétition getCampaign')
    expect(campaign.text).toBeTruthy()
    expect(campaign.tiers).toEqual([{ threshold: 1000, label: 'On démarre' }])
    expect(campaign.nextTier).toEqual({ threshold: 1000, label: 'On démarre' })
    expect(campaign.recentSignatures).toEqual([
      expect.objectContaining({ pseudo: 'Sacha', city: 'Lyon' }),
    ])
    // Guards the reason `listRecentSignatures` exists at all: no citizen email.
    expect(campaign.recentSignatures[0]).not.toHaveProperty('email')
  })

  it('returns null for a draft campaign', async () => {
    const campaign = await getCampaign(getCampaignPayload, {
      organization: `test-org-getcampaign-${run}`,
      slug: `test-getcampaign-draft-${run}`,
      locale: 'fr',
    })

    expect(campaign).toBeNull()
  })

  it('returns null for an unknown slug', async () => {
    const campaign = await getCampaign(getCampaignPayload, {
      organization: `test-org-getcampaign-${run}`,
      slug: 'does-not-exist',
      locale: 'fr',
    })

    expect(campaign).toBeNull()
  })
})
