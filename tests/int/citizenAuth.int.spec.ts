import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { citizenSessionStrategy } from '@/lib/citizenSession'
import { consumeMagicLink, createMagicLink } from '@/lib/magicLink'
import config from '@/payload.config'

let payload: Payload
let req: PayloadRequest

/** Unique per run so repeated runs never collide on emails. */
const run = Date.now()

const citizenIds: number[] = []

/** Pulls the `name=value` pair out of a `Set-Cookie` string, for building a `Cookie` header. */
const cookiePair = (setCookie: string): string => setCookie.split(';')[0]

describe('magic link', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    req = await createLocalReq({}, payload)
  })

  afterAll(async () => {
    if (citizenIds.length > 0) {
      await payload.delete({ collection: 'citizens', where: { id: { in: citizenIds } } })
    }
    await payload.delete({
      collection: 'magic-links',
      where: { email: { contains: `citizen-auth-${run}` } },
    })
  })

  it('round-trips: create → consume creates a verified citizen and a session cookie', async () => {
    const email = `citizen-auth-${run}-a@example.com`
    const { rawToken } = await createMagicLink(req, { email, pseudo: 'Sacha', lang: 'fr' })

    const result = await consumeMagicLink(req, rawToken)
    expect(result).not.toBeNull()
    expect(result!.citizen.email).toBe(email)
    expect(result!.citizen.pseudo).toBe('Sacha')
    expect(result!.citizen.emailVerified).toBe(true)
    expect(result!.cookie).toContain('citizen-token=')
    // `lang` round-trips through `magic-links.intent.payload`, not the verify
    // URL's query string — see the comment on `createMagicLink`.
    expect(result!.lang).toBe('fr')

    citizenIds.push(result!.citizen.id)
  })

  it('is single-use: consuming the same raw token twice returns null the second time', async () => {
    const email = `citizen-auth-${run}-b@example.com`
    const { rawToken } = await createMagicLink(req, { email, pseudo: 'Sacha', lang: 'fr' })

    const first = await consumeMagicLink(req, rawToken)
    expect(first).not.toBeNull()
    citizenIds.push(first!.citizen.id)

    const second = await consumeMagicLink(req, rawToken)
    expect(second).toBeNull()
  })

  it('rejects an expired token', async () => {
    const email = `citizen-auth-${run}-c@example.com`
    const { rawToken } = await createMagicLink(req, { email, pseudo: 'Sacha', lang: 'fr' })

    const { docs } = await payload.find({
      collection: 'magic-links',
      where: { email: { equals: email } },
      limit: 1,
    })
    await payload.update({
      collection: 'magic-links',
      id: docs[0].id,
      data: { expiresAt: new Date(Date.now() - 1000).toISOString() },
    })

    const result = await consumeMagicLink(req, rawToken)
    expect(result).toBeNull()
  })

  it('reuses the existing citizen on a second sign-in and does not overwrite an existing pseudo', async () => {
    const email = `citizen-auth-${run}-d@example.com`

    const { rawToken: firstToken } = await createMagicLink(req, {
      email,
      pseudo: 'Original',
      lang: 'fr',
    })
    const first = await consumeMagicLink(req, firstToken)
    citizenIds.push(first!.citizen.id)

    const { rawToken: secondToken } = await createMagicLink(req, {
      email,
      pseudo: 'Different',
      lang: 'fr',
    })
    const second = await consumeMagicLink(req, secondToken)

    expect(second!.citizen.id).toBe(first!.citizen.id)
    expect(second!.citizen.pseudo).toBe('Original')
  })

  it('citizenSessionStrategy authenticates a valid session cookie, and rejects a revoked one', async () => {
    const email = `citizen-auth-${run}-e@example.com`
    const { rawToken } = await createMagicLink(req, { email, pseudo: 'Sacha', lang: 'fr' })
    const { citizen, cookie } = (await consumeMagicLink(req, rawToken))!
    citizenIds.push(citizen.id)

    const headers = new Headers({ Cookie: cookiePair(cookie) })

    const authed = await citizenSessionStrategy.authenticate({ headers, payload })
    expect(authed.user?.collection).toBe('citizens')
    expect(authed.user?.id).toBe(citizen.id)

    // Revoke: clear the session array server-side, as logout does.
    await payload.update({ collection: 'citizens', id: citizen.id, data: { sessions: [] } })

    const afterRevoke = await citizenSessionStrategy.authenticate({ headers, payload })
    expect(afterRevoke.user).toBeNull()
  })

  it('citizenSessionStrategy returns no user when no cookie is present', async () => {
    const authed = await citizenSessionStrategy.authenticate({ headers: new Headers(), payload })
    expect(authed.user).toBeNull()
  })
})
