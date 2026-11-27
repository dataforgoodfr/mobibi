import { sql } from 'drizzle-orm'
import { SignJWT } from 'jose'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { completeLogin, safeReturnTo, startLogin } from '@/lib/campaignerLogin'
import {
  CAMPAIGNER_SESSION_MAX_LIFETIME_SECONDS,
  createCampaignerSession,
  getCampaigner,
  readCampaignerSession,
} from '@/lib/campaignerSession'
import { getDrizzleDb } from '@/lib/db'
import { decryptSecret } from '@/lib/secretBox'
import config from '@/payload.config'

import { startOidcMock, type MockUser, type OidcMock } from '../helpers/oidcMock'

let payload: Payload
let mock: OidcMock

const run = Date.now()
const email = (name: string) => `${name}-${run}@example.org`
const sub = (name: string) => `${name}-${run}`

const cookieValue = (setCookie: string): string => {
  const pair = setCookie.split(';')[0]
  return pair.slice(pair.indexOf('=') + 1)
}

const expectCookieAttributes = (setCookie: string) => {
  expect(setCookie).toMatch(/; HttpOnly/)
  expect(setCookie).toMatch(/; SameSite=Lax/)
  expect(setCookie).toMatch(/; Path=\//)
}

const callbackFor = async (user: MockUser, returnTo: string | null = null) => {
  mock.setUser(user)
  const { redirectUrl, setCookie } = await startLogin(returnTo)
  const callback = await mock.authorizeCode(redirectUrl)
  return { search: callback.search, flowCookie: cookieValue(setCookie) }
}

const login = async (user: MockUser, returnTo: string | null = null) => {
  const { search, flowCookie } = await callbackFor(user, returnTo)
  return completeLogin(payload, search, flowCookie)
}

const verified = (name: string, extra: Partial<MockUser> = {}): MockUser => ({
  sub: sub(name),
  email: email(name),
  email_verified: true,
  name,
  roles: ['access'],
  sid: `sid-${name}-${run}`,
  ...extra,
})

const findBySubject = async (subject: string) =>
  (
    await payload.find({
      collection: 'campaigners',
      where: { oidcSubject: { equals: subject } },
      depth: 0,
    })
  ).docs

const sessionsOf = async (campaignerId: number) =>
  (
    await payload.find({
      collection: 'campaigner-sessions',
      where: { campaigner: { equals: campaignerId } },
      depth: 0,
    })
  ).docs

describe('campaigner OIDC login', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    mock = await startOidcMock(4010)
  })

  afterAll(async () => {
    await payload.delete({
      collection: 'campaigners',
      where: { email: { contains: `-${run}@` } },
    })
    await mock.stop()
  })

  describe('safeReturnTo', () => {
    it.each(['/fr/dashboard', '/fr/dashboard?x=1'])('keeps %s', (value) => {
      expect(safeReturnTo(value)).toBe(value)
    })

    it.each([
      '//evil.com',
      '/\\evil.com',
      'https://evil.com',
      '%2F%2Fevil.com',
      'javascript:alert(1)',
      '/\t/evil.com',
      '',
      null,
      undefined,
    ])('rejects %j', (value) => {
      expect(safeReturnTo(value)).toBe('/fr/dashboard')
    })
  })

  it('creates the campaigner and an encrypted session on first login', async () => {
    const user = verified('first', { name: 'Alice' })
    const result = await login(user, '/fr/dashboard?x=1')

    expect(result).toMatchObject({ ok: true, returnTo: '/fr/dashboard?x=1' })
    const sessionCookie = result.setCookies.find((c) => c.startsWith('campaigner-token='))!
    const clearedFlow = result.setCookies.find((c) => c.startsWith('campaigner-oidc=;'))!
    expect(sessionCookie).toMatch(/; Max-Age=43200/)
    expect(clearedFlow).toMatch(/Expires=Thu, 01 Jan 1970/)
    for (const cookie of [sessionCookie, clearedFlow]) expectCookieAttributes(cookie)

    const [campaigner] = await findBySubject(user.sub)
    expect(campaigner).toMatchObject({
      email: user.email,
      name: 'Alice',
      oidcIssuer: mock.issuer,
      oidcSubject: user.sub,
    })
    expect(campaigner.lastLoginAt).toBeTruthy()

    const [session] = await sessionsOf(campaigner.id)
    expect(session.oidcSid).toBe(user.sid)
    expect(session.idToken).toBeTruthy()
    expect(session.refreshToken).toBeTruthy()
    const refreshToken = decryptSecret(session.refreshToken!, payload.secret)
    expect(session.refreshToken).not.toBe(refreshToken)
    expect(refreshToken).toMatch(/^[0-9a-f-]{36}$/)
    expect(new Date(session.accessTokenExpiresAt!).getTime()).toBeGreaterThan(Date.now())
    expect(new Date(session.expiresAt).getTime()).toBeGreaterThan(Date.now() + 11 * 3600_000)
  })

  it('sets a flow cookie that lasts ten minutes', async () => {
    const { setCookie } = await startLogin(null)
    expect(setCookie).toMatch(/^campaigner-oidc=[^;]+; /)
    expect(setCookie).toMatch(/; Max-Age=600/)
    expectCookieAttributes(setCookie)
  })

  describe('session lifetime', () => {
    const minutes = (n: number) => n * 60_000
    const tokens = (refreshExpiresAt: Date | null) => ({
      sid: null,
      idToken: 'id-token',
      refreshToken: 'refresh-token',
      accessTokenExpiresAt: null,
      refreshExpiresAt,
    })

    let campaignerId: number
    beforeAll(async () => {
      const created = await payload.create({
        collection: 'campaigners',
        data: { email: email('lifetime') },
      })
      campaignerId = created.id
    })

    const createAndRead = async (refreshExpiresAt: Date | null) => {
      const cookie = await createCampaignerSession(payload, campaignerId, tokens(refreshExpiresAt))
      const sessions = await sessionsOf(campaignerId)
      const row = sessions.sort((a, b) => b.id - a.id)[0]
      return { cookie, expiresAt: new Date(row.expiresAt).getTime(), row }
    }

    it('keeps the cookie for the full lifetime when the refresh window is short', async () => {
      const { cookie, expiresAt, row } = await createAndRead(new Date(Date.now() + minutes(30)))
      expect(CAMPAIGNER_SESSION_MAX_LIFETIME_SECONDS).toBe(43200)
      expect(cookie).toMatch(/; Max-Age=43200/)
      expect(Math.abs(expiresAt - (Date.now() + minutes(30)))).toBeLessThan(minutes(1))
      expect(row.accessTokenExpiresAt ?? null).toBeNull()
    })

    it('caps the row at the cookie lifetime when the refresh window is longer', async () => {
      const { cookie, expiresAt } = await createAndRead(new Date(Date.now() + minutes(24 * 60)))
      expect(cookie).toMatch(/; Max-Age=43200/)
      expect(Math.abs(expiresAt - (Date.now() + minutes(12 * 60)))).toBeLessThan(minutes(1))
    })

    it('uses the cookie lifetime without a refresh window', async () => {
      const { expiresAt } = await createAndRead(null)
      expect(Math.abs(expiresAt - (Date.now() + minutes(12 * 60)))).toBeLessThan(minutes(1))
    })
  })

  it('reuses the campaigner on a later login and refreshes email and name', async () => {
    const first = await login(verified('again'))
    expect(first.ok).toBe(true)
    const [before] = await findBySubject(sub('again'))

    const result = await login(verified('again', { email: email('again-new'), name: 'Renamed' }))
    expect(result.ok).toBe(true)

    const after = await findBySubject(sub('again'))
    expect(after).toHaveLength(1)
    expect(after[0]).toMatchObject({ id: before.id, email: email('again-new'), name: 'Renamed' })
    expect(await sessionsOf(before.id)).toHaveLength(2)
  })

  it('creates a campaigner without a name claim', async () => {
    const result = await login(verified('noname', { name: undefined }))
    expect(result.ok).toBe(true)
    const [campaigner] = await findBySubject(sub('noname'))
    expect(campaigner.name ?? '').toBe('')
  })

  it('creates exactly one campaigner when two first logins race', async () => {
    const user = verified('race')
    const a = await callbackFor(user)
    const b = await callbackFor(user)

    const results = await Promise.all([
      completeLogin(payload, a.search, a.flowCookie),
      completeLogin(payload, b.search, b.flowCookie),
    ])

    expect(results.map((r) => r.ok)).toEqual([true, true])
    const campaigners = await findBySubject(user.sub)
    expect(campaigners).toHaveLength(1)
    expect(await sessionsOf(campaigners[0].id)).toHaveLength(2)
  })

  // The race above rarely interleaves both creates; this replays the losing side deterministically
  // by hiding the winner from the two pre-create lookups.
  describe('when another login wins the race to create', () => {
    const hidingFirstLookups = (): Payload => {
      let hidden = 2
      return new Proxy(payload, {
        get(target, key) {
          if (key === 'find') {
            return (args: Parameters<Payload['find']>[0]) =>
              args.collection === 'campaigners' && hidden-- > 0
                ? Promise.resolve({ docs: [] })
                : target.find(args)
          }
          const value = Reflect.get(target, key)
          return typeof value === 'function' ? value.bind(target) : value
        },
      })
    }

    it('falls back to the winner when it holds this identity', async () => {
      const user = verified('lost-race')
      const winner = await payload.create({
        collection: 'campaigners',
        data: { email: user.email!, oidcIssuer: mock.issuer, oidcSubject: user.sub },
      })

      const { search, flowCookie } = await callbackFor(user)
      const result = await completeLogin(hidingFirstLookups(), search, flowCookie)

      expect(result.ok).toBe(true)
      const campaigners = await findBySubject(user.sub)
      expect(campaigners).toHaveLength(1)
      expect(campaigners[0]).toMatchObject({ id: winner.id, name: 'lost-race' })
      expect(await sessionsOf(winner.id)).toHaveLength(1)
    })

    it('reports email-conflict when the winner is someone else', async () => {
      const user = verified('lost-race-other')
      const other = await payload.create({
        collection: 'campaigners',
        data: { email: user.email!, oidcIssuer: mock.issuer, oidcSubject: sub('someone-else') },
      })

      const { search, flowCookie } = await callbackFor(user)
      const result = await completeLogin(hidingFirstLookups(), search, flowCookie)

      expect(result).toMatchObject({ ok: false, error: 'email-conflict' })
      expect(await findBySubject(user.sub)).toHaveLength(0)
      expect(await sessionsOf(other.id)).toHaveLength(0)
    })
  })

  describe('refusals', () => {
    const expectNoCampaigner = async (subject: string) => {
      expect(await findBySubject(subject)).toHaveLength(0)
    }

    it('rejects a tampered state', async () => {
      const { search, flowCookie } = await callbackFor(verified('state'))
      const params = new URLSearchParams(search)
      params.set('state', 'forged')
      const result = await completeLogin(payload, `?${params}`, flowCookie)
      expect(result).toMatchObject({ ok: false, error: 'state', lang: 'fr' })
      expect(result.setCookies.some((c) => c.startsWith('campaigner-oidc=;'))).toBe(true)
      await expectNoCampaigner(sub('state'))
    })

    it('rejects a missing flow cookie', async () => {
      const { search } = await callbackFor(verified('nocookie'))
      const result = await completeLogin(payload, search, undefined)
      expect(result).toMatchObject({ ok: false, error: 'state', lang: 'fr' })
      await expectNoCampaigner(sub('nocookie'))
    })

    it('rejects an invalid flow cookie', async () => {
      const { search } = await callbackFor(verified('badcookie'))
      const result = await completeLogin(payload, search, 'not-a-jwt')
      expect(result).toMatchObject({ ok: false, error: 'state' })
      await expectNoCampaigner(sub('badcookie'))
    })

    it('rejects a replayed callback without throwing', async () => {
      const { search, flowCookie } = await callbackFor(verified('replay'))
      const first = await completeLogin(payload, search, flowCookie)
      expect(first.ok).toBe(true)
      const [campaigner] = await findBySubject(sub('replay'))

      const second = await completeLogin(payload, search, flowCookie)
      expect(second.ok).toBe(false)
      if (!second.ok) expect(['state', 'provider']).toContain(second.error)
      expect(await sessionsOf(campaigner.id)).toHaveLength(1)
    })

    it.each([
      ['nonce', { nonce: 'x' }],
      ['issuer', { iss: 'http://other' }],
      ['audience', { aud: 'other' }],
    ])('rejects an id token with a wrong %s', async (label, patch) => {
      const name = `tamper-${label}`
      const { search, flowCookie } = await callbackFor(verified(name))
      mock.tamperIdToken(patch)
      const result = await completeLogin(payload, search, flowCookie)
      expect(result).toMatchObject({ ok: false, error: 'provider' })
      await expectNoCampaigner(sub(name))
    })

    it('reports a malformed provider email as provider, not email-conflict', async () => {
      const result = await login(verified('malformed', { email: 'not-an-email' }))
      expect(result).toMatchObject({ ok: false, error: 'provider' })
      await expectNoCampaigner(sub('malformed'))
    })

    it('rejects a missing email', async () => {
      const result = await login(verified('noemail', { email: undefined }))
      expect(result).toMatchObject({ ok: false, error: 'email-missing' })
      await expectNoCampaigner(sub('noemail'))
    })

    it('rejects an unverified email', async () => {
      const result = await login(verified('unverified', { email_verified: false }))
      expect(result).toMatchObject({ ok: false, error: 'email-unverified' })
      await expectNoCampaigner(sub('unverified'))
    })

    it('rejects a missing required role', async () => {
      const result = await login(verified('norole', { roles: [] }))
      expect(result).toMatchObject({ ok: false, error: 'access-denied' })
      await expectNoCampaigner(sub('norole'))
    })

    it.each([
      ['same case', (value: string) => value],
      ['another case', (value: string) => value.toUpperCase()],
    ])('rejects a new subject whose email is already used (%s)', async (label, transform) => {
      const owner = `owner-${label.replace(' ', '-')}`
      expect((await login(verified(owner))).ok).toBe(true)
      const [existing] = await findBySubject(sub(owner))

      const intruder = `intruder-${label.replace(' ', '-')}`
      const result = await login(verified(intruder, { email: transform(email(owner)) }))
      expect(result).toMatchObject({ ok: false, error: 'email-conflict' })
      await expectNoCampaigner(sub(intruder))
      expect(await sessionsOf(existing.id)).toHaveLength(1)
    })

    it('rejects an existing campaigner switching to an email another one owns', async () => {
      expect((await login(verified('taken'))).ok).toBe(true)
      expect((await login(verified('switcher'))).ok).toBe(true)
      const [before] = await findBySubject(sub('switcher'))

      const result = await login(verified('switcher', { email: email('taken'), name: 'Changed' }))
      expect(result).toMatchObject({ ok: false, error: 'email-conflict' })

      const [after] = await findBySubject(sub('switcher'))
      expect(after).toMatchObject({
        email: before.email,
        name: before.name,
        lastLoginAt: before.lastLoginAt,
      })
      expect(await sessionsOf(before.id)).toHaveLength(1)
    })

    it('maps a provider access_denied to access-denied, even without a flow cookie', async () => {
      await callbackFor(verified('denied'))
      const result = await completeLogin(payload, '?error=access_denied&state=s', undefined)
      expect(result).toMatchObject({ ok: false, error: 'access-denied', lang: 'fr' })
      await expectNoCampaigner(sub('denied'))
    })

    it('maps any other provider error to provider', async () => {
      const { flowCookie } = await callbackFor(verified('providererror'))
      const result = await completeLogin(payload, '?error=server_error', flowCookie)
      expect(result).toMatchObject({ ok: false, error: 'provider' })
      await expectNoCampaigner(sub('providererror'))
    })
  })

  describe('getCampaigner', () => {
    const headersFor = (setCookie: string) =>
      new Headers({ cookie: `campaigner-token=${cookieValue(setCookie)}` })

    const signIn = async (name: string, extra: Partial<MockUser> = {}) => {
      const user = verified(name, extra)
      const result = await login(user)
      if (!result.ok) throw new Error(`login failed: ${result.error}`)
      const [campaigner] = await findBySubject(user.sub)
      const [session] = await sessionsOf(campaigner.id)
      const setCookie = result.setCookies.find((c) => c.startsWith('campaigner-token='))!
      return { user, campaigner, session, headers: headersFor(setCookie) }
    }

    const findSession = (id: number) =>
      payload.findByID({ collection: 'campaigner-sessions', id, depth: 0, disableErrors: true })

    const expireAccessToken = (id: number, value: string | null = new Date(0).toISOString()) =>
      payload.update({
        collection: 'campaigner-sessions',
        id,
        data: { accessTokenExpiresAt: value },
      })

    it('returns the campaigner for a fresh session without refreshing', async () => {
      const { campaigner, headers } = await signIn('gc-fresh')
      const before = mock.refreshCount()
      expect(await getCampaigner(payload, headers)).toMatchObject({ id: campaigner.id })
      expect(mock.refreshCount()).toBe(before)
    })

    it('returns null without a cookie or with a forged one', async () => {
      expect(await getCampaigner(payload, new Headers())).toBeNull()
      expect(
        await getCampaigner(payload, new Headers({ cookie: 'campaigner-token=forged' })),
      ).toBeNull()
    })

    it('returns null for a cookie signed with another audience', async () => {
      const { session } = await signIn('gc-audience')
      const token = await new SignJWT({ sid: session.id })
        .setProtectedHeader({ alg: 'HS256' })
        .setAudience('campaigner-oidc-flow')
        .setExpirationTime('1h')
        .sign(new TextEncoder().encode(payload.secret))
      const headers = new Headers({ cookie: `campaigner-token=${token}` })
      expect(await getCampaigner(payload, headers)).toBeNull()
    })

    it('returns null once the row is deleted', async () => {
      const { session, headers } = await signIn('gc-deleted')
      await payload.delete({ collection: 'campaigner-sessions', id: session.id })
      expect(await getCampaigner(payload, headers)).toBeNull()
    })

    it('returns null and deletes the row past expiresAt', async () => {
      const { session, headers } = await signIn('gc-expired')
      await payload.update({
        collection: 'campaigner-sessions',
        id: session.id,
        data: { expiresAt: new Date(Date.now() - 1000).toISOString() },
      })
      expect(await getCampaigner(payload, headers)).toBeNull()
      expect(await findSession(session.id)).toBeNull()
    })

    it('reads the session row without refreshing', async () => {
      const { session, headers } = await signIn('gc-read')
      await expireAccessToken(session.id)
      const before = mock.refreshCount()
      expect(await readCampaignerSession(payload, headers)).toMatchObject({ id: session.id })
      expect(mock.refreshCount()).toBe(before)
    })

    it('refreshes an expired access token once and stores the new tokens', async () => {
      const { campaigner, session, headers } = await signIn('gc-refresh')
      await expireAccessToken(session.id)
      const before = mock.refreshCount()

      expect(await getCampaigner(payload, headers)).toMatchObject({ id: campaigner.id })
      expect(mock.refreshCount()).toBe(before + 1)

      const row = (await findSession(session.id))!
      expect(new Date(row.accessTokenExpiresAt!).getTime()).toBeGreaterThan(Date.now() + 60_000)
      const oldToken = decryptSecret(session.refreshToken!, payload.secret)
      const newToken = decryptSecret(row.refreshToken!, payload.secret)
      expect(newToken).not.toBe(oldToken)
      expect(row.idToken).toBeTruthy()
      expect(row.expiresAt).toBe(session.expiresAt)

      expect(await getCampaigner(payload, headers)).toMatchObject({ id: campaigner.id })
      expect(mock.refreshCount()).toBe(before + 1)
    })

    it('refreshes when accessTokenExpiresAt is null', async () => {
      const { campaigner, session, headers } = await signIn('gc-null-expiry')
      await expireAccessToken(session.id, null)
      const before = mock.refreshCount()
      expect(await getCampaigner(payload, headers)).toMatchObject({ id: campaigner.id })
      expect(mock.refreshCount()).toBe(before + 1)
    })

    it('caps expiresAt at the session max lifetime on refresh', async () => {
      const { session, headers } = await signIn('gc-cap')
      await getDrizzleDb(payload).execute(
        sql`UPDATE campaigner_sessions SET created_at = now() - interval '11 hours' WHERE id = ${session.id}`,
      )
      await expireAccessToken(session.id)

      expect(await getCampaigner(payload, headers)).not.toBeNull()
      const row = (await findSession(session.id))!
      const cap = new Date(row.createdAt).getTime() + CAMPAIGNER_SESSION_MAX_LIFETIME_SECONDS * 1000
      expect(new Date(row.expiresAt).getTime()).toBe(cap)
      expect(Math.abs(cap - (Date.now() + 3600_000))).toBeLessThan(60_000)
    })

    it('slides expiresAt to the new refresh window', async () => {
      const { session, headers } = await signIn('gc-slide')
      await expireAccessToken(session.id)
      mock.patchNextRefresh({ refresh_expires_in: 1800 })

      expect(await getCampaigner(payload, headers)).not.toBeNull()
      const row = (await findSession(session.id))!
      expect(Math.abs(new Date(row.expiresAt).getTime() - (Date.now() + 1800_000))).toBeLessThan(
        60_000,
      )
    })

    it('caps a sliding refresh window at the session max lifetime', async () => {
      const { session, headers } = await signIn('gc-slide-cap')
      await expireAccessToken(session.id)
      mock.patchNextRefresh({ refresh_expires_in: 2 * CAMPAIGNER_SESSION_MAX_LIFETIME_SECONDS })

      expect(await getCampaigner(payload, headers)).not.toBeNull()
      const row = (await findSession(session.id))!
      const cap = new Date(row.createdAt).getTime() + CAMPAIGNER_SESSION_MAX_LIFETIME_SECONDS * 1000
      expect(new Date(row.expiresAt).getTime()).toBe(cap)
    })

    it('returns null and deletes the row when the refresh fails', async () => {
      const { session, headers } = await signIn('gc-fail')
      await expireAccessToken(session.id)
      mock.failNextRefresh()
      expect(await getCampaigner(payload, headers)).toBeNull()
      expect(await findSession(session.id)).toBeNull()
    })

    it('returns null and deletes the row when the role is gone on refresh', async () => {
      const { user, session, headers } = await signIn('gc-role')
      await expireAccessToken(session.id)
      mock.setUser({ ...user, roles: [] })
      expect(await getCampaigner(payload, headers)).toBeNull()
      expect(await findSession(session.id)).toBeNull()
    })

    it('lets only one of several parallel requests refresh', async () => {
      const { campaigner, session, headers } = await signIn('gc-parallel')
      await expireAccessToken(session.id)
      const before = mock.refreshCount()

      const results = await Promise.all(
        Array.from({ length: 5 }, () => getCampaigner(payload, headers)),
      )

      expect(results.map((r) => r?.id)).toEqual(Array(5).fill(campaigner.id))
      expect(mock.refreshCount()).toBe(before + 1)
    })

    it('never refreshes a session without a refresh token', async () => {
      const created = await payload.create({
        collection: 'campaigners',
        data: { email: email('gc-no-oidc') },
      })
      const setCookie = await createCampaignerSession(payload, created.id, null)
      const before = mock.refreshCount()
      expect(await getCampaigner(payload, headersFor(setCookie))).toMatchObject({ id: created.id })
      expect(mock.refreshCount()).toBe(before)
    })
  })
})
