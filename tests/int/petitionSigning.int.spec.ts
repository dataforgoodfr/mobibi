import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { consumeMagicLink, createMagicLink } from '@/lib/magicLink'
import { createSignature, hasSigned } from '@/lib/signatures'
import config from '@/payload.config'

let payload: Payload
let req: PayloadRequest

/** Unique per run so repeated runs never collide on slugs or emails. */
const run = Date.now()

const orgSlug = `signing-org-${run}`
const petitionSlug = `signing-petition-${run}`

let orgId: number
let petitionId: number
let citizenId: number

/** The denormalised counter, read back straight from the petition row. */
const signatureCount = async (): Promise<number> => {
  const petition = await payload.findByID({ collection: 'petitions', id: petitionId, depth: 0 })
  return petition.signatureCount ?? 0
}

describe('petition signing', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    req = await createLocalReq({}, payload)

    const org = await payload.create({
      collection: 'organizations',
      data: { name: `Signing org ${run}`, slug: orgSlug },
    })
    orgId = org.id

    const petition = await payload.create({
      collection: 'petitions',
      data: {
        organization: orgId,
        slug: petitionSlug,
        status: 'active',
        title: 'Pétition à signer',
        additionalFields: [{ label: 'Code postal', required: false }],
      },
    })
    petitionId = petition.id

    const citizen = await payload.create({
      collection: 'citizens',
      data: { email: `signing-${run}-a@example.com`, pseudo: 'Alex', emailVerified: true },
    })
    citizenId = citizen.id
  })

  afterAll(async () => {
    await payload.delete({
      collection: 'petition-signatures',
      where: { petition: { equals: petitionId } },
    })
    await payload.delete({
      collection: 'citizens',
      where: { email: { contains: `signing-${run}` } },
    })
    await payload.delete({
      collection: 'magic-links',
      where: { email: { contains: `signing-${run}` } },
    })
    await payload.delete({ collection: 'petitions', id: petitionId })
    await payload.delete({ collection: 'organizations', id: orgId })
  })

  it('writes the city and response snapshot, and bumps the counter', async () => {
    expect(await hasSigned(payload, petitionId, citizenId)).toBe(false)
    const before = await signatureCount()

    await createSignature(req, citizenId, {
      petitionId,
      city: 'Rennes',
      responses: [{ label: 'Code postal', value: '35000' }],
    })

    expect(await signatureCount()).toBe(before + 1)
    expect(await hasSigned(payload, petitionId, citizenId)).toBe(true)

    const { docs } = await payload.find({
      collection: 'petition-signatures',
      where: { and: [{ petition: { equals: petitionId } }, { citizen: { equals: citizenId } }] },
      limit: 1,
    })
    expect(docs[0].city).toBe('Rennes')
    expect(docs[0].responses?.[0]).toMatchObject({ label: 'Code postal', value: '35000' })
  })

  it('rejects a second signature from the same citizen, and does not move the counter', async () => {
    const before = await signatureCount()

    await expect(createSignature(req, citizenId, { petitionId })).rejects.toThrow()

    expect(await signatureCount()).toBe(before)
  })

  it('a petition-signature magic link creates the citizen, the signature, and lands on the petition', async () => {
    const email = `signing-${run}-b@example.com`
    const before = await signatureCount()

    const { rawToken } = await createMagicLink(req, {
      email,
      pseudo: 'Camille',
      lang: 'fr',
      intent: {
        type: 'petition-signature',
        payload: {
          petitionId,
          city: 'Lyon',
          responses: [{ label: 'Code postal', value: '69001' }],
        },
      },
    })

    const result = await consumeMagicLink(req, rawToken)
    expect(result).not.toBeNull()
    expect(result!.citizen.email).toBe(email)
    expect(result!.citizen.emailVerified).toBe(true)
    // Built from the petition's own slugs, never from the verify request —
    // and carrying no « just signed » flag: the page derives that itself.
    expect(result!.redirectTo).toBe(`/fr/${orgSlug}/${petitionSlug}`)

    expect(await signatureCount()).toBe(before + 1)
    expect(await hasSigned(payload, petitionId, result!.citizen.id)).toBe(true)
  })

  it('replaying the same token does not sign twice', async () => {
    const email = `signing-${run}-c@example.com`

    const { rawToken } = await createMagicLink(req, {
      email,
      pseudo: 'Dominique',
      lang: 'fr',
      intent: { type: 'petition-signature', payload: { petitionId } },
    })

    await consumeMagicLink(req, rawToken)
    const after = await signatureCount()

    // The single-use claim is what stops one click counting twice — the
    // second call must perform no write at all, not just skip the session.
    expect(await consumeMagicLink(req, rawToken)).toBeNull()
    expect(await signatureCount()).toBe(after)
  })

  it('propagates a real write failure instead of redirecting to a thank-you', async () => {
    const email = `signing-${run}-e@example.com`

    // A petition id that does not exist: the relationship validation fails,
    // which is NOT the one-signature-per-citizen case. Redemption must throw
    // rather than swallow it and send the citizen to `?signed=1` for a
    // signature that was never written.
    const { rawToken } = await createMagicLink(req, {
      email,
      pseudo: 'Alix',
      lang: 'fr',
      intent: { type: 'petition-signature', payload: { petitionId: 99_999_999 } },
    })

    await expect(consumeMagicLink(req, rawToken)).rejects.toThrow()
  })

  it('a plain login link still lands on the locale home', async () => {
    const email = `signing-${run}-d@example.com`
    const { rawToken } = await createMagicLink(req, { email, pseudo: 'Sacha', lang: 'fr' })

    const result = await consumeMagicLink(req, rawToken)
    expect(result!.redirectTo).toBe('/fr')
  })
})
