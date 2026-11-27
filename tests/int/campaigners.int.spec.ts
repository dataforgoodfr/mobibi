import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'

let payload: Payload
const run = Date.now()
const email = (name: string) => `${name}-${run}@example.org`

describe('campaigners', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  afterAll(async () => {
    await payload.delete({
      collection: 'campaigners',
      where: { email: { contains: `-${run}@` } },
    })
    await payload.delete({
      collection: 'organizations',
      where: { name: { contains: `reserved-${run}` } },
    })
  })

  it('rejects a duplicate (issuer, subject) pair', async () => {
    const identity = { oidcIssuer: `https://idp-${run}.test`, oidcSubject: 'sub-1' }
    await payload.create({
      collection: 'campaigners',
      data: { email: email('dup-a'), name: 'A', ...identity },
    })
    await expect(
      payload.create({
        collection: 'campaigners',
        data: { email: email('dup-b'), name: 'B', ...identity },
      }),
    ).rejects.toThrow(/oidcSubject/)
  })

  it('allows the same subject under a different issuer', async () => {
    await payload.create({
      collection: 'campaigners',
      data: {
        email: email('iss-a'),
        name: 'A',
        oidcIssuer: `https://one-${run}.test`,
        oidcSubject: 'same',
      },
    })
    const other = await payload.create({
      collection: 'campaigners',
      data: {
        email: email('iss-b'),
        name: 'B',
        oidcIssuer: `https://two-${run}.test`,
        oidcSubject: 'same',
      },
    })
    expect(other.id).toBeDefined()
  })

  it('rejects a partial update that collides with another identity', async () => {
    const oidcIssuer = `https://partial-${run}.test`
    await payload.create({
      collection: 'campaigners',
      data: { email: email('part-a'), oidcIssuer, oidcSubject: 'subA' },
    })
    const b = await payload.create({
      collection: 'campaigners',
      data: { email: email('part-b'), oidcIssuer, oidcSubject: 'subB' },
    })
    await expect(
      payload.update({ collection: 'campaigners', id: b.id, data: { oidcSubject: 'subA' } }),
    ).rejects.toThrow(/oidcSubject/)
  })

  it('creates a campaigner with only an email', async () => {
    const c = await payload.create({
      collection: 'campaigners',
      data: { email: email('only-email') },
    })
    expect(c.id).toBeDefined()
  })

  it('allows several campaigners without an OIDC identity', async () => {
    await payload.create({ collection: 'campaigners', data: { email: email('none-a'), name: 'A' } })
    const second = await payload.create({
      collection: 'campaigners',
      data: { email: email('none-b'), name: 'B' },
    })
    expect(second.id).toBeDefined()
  })

  it('does not flag a campaigner against itself on update', async () => {
    const c = await payload.create({
      collection: 'campaigners',
      data: {
        email: email('self'),
        name: 'S',
        oidcIssuer: `https://self-${run}.test`,
        oidcSubject: 'me',
      },
    })
    const updated = await payload.update({
      collection: 'campaigners',
      id: c.id,
      data: { name: 'S2' },
    })
    expect(updated.name).toBe('S2')
  })

  it('stores the email lowercase and keeps it unique', async () => {
    const created = await payload.create({
      collection: 'campaigners',
      data: { email: `Alice-${run}@Example.org`, name: 'Alice' },
    })
    expect(created.email).toBe(`alice-${run}@example.org`)
    await expect(
      payload.create({
        collection: 'campaigners',
        data: { email: `alice-${run}@example.org`, name: 'Alice 2' },
      }),
    ).rejects.toThrow(/email|unique/i)
  })

  it('deletes the sessions of a deleted campaigner', async () => {
    const c = await payload.create({
      collection: 'campaigners',
      data: { email: email('sessions'), name: 'S' },
    })
    await payload.create({
      collection: 'campaigner-sessions',
      data: { campaigner: c.id, expiresAt: new Date(Date.now() + 60_000).toISOString() },
    })
    await payload.delete({ collection: 'campaigners', id: c.id })
    const left = await payload.find({
      collection: 'campaigner-sessions',
      where: { campaigner: { equals: c.id } },
    })
    expect(left.totalDocs).toBe(0)
  })
})

describe('reserved organization slugs', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it.each(['dashboard', 'Dashboard'])('rejects "%s"', async (slug) => {
    await expect(
      payload.create({
        collection: 'organizations',
        data: { name: `reserved-${run}`, slug },
      }),
    ).rejects.toThrow(/invalid|valid|reserved/i)
  })
})
