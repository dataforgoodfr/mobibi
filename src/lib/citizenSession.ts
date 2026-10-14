import { randomUUID } from 'node:crypto'

import { jwtVerify } from 'jose'
import { generateCookie, jwtSign, parseCookies } from 'payload'
import type { AuthStrategy, Payload, PayloadRequest } from 'payload'

import type { Citizen } from '@/payload-types'

/** Six months — imported by `Citizens.ts` for `auth.tokenExpiration`, the single source of truth. */
export const CITIZEN_SESSION_TTL_SECONDS = 60 * 60 * 24 * 180

const COOKIE_NAME = 'citizen-token'

const isProduction = process.env.NODE_ENV === 'production'

type CitizenSession = NonNullable<Citizen['sessions']>[number]

const removeExpiredSessions = (sessions: CitizenSession[]): CitizenSession[] => {
  const now = new Date()
  return sessions.filter((session) => new Date(session.expiresAt) > now)
}

/**
 * Mints a new session for `citizenId` and returns the `Set-Cookie` string for it.
 *
 * Appends `{ id, createdAt, expiresAt }` onto `citizen.sessions` via `payload.update` —
 * that field carries Payload's own `access: { update: () => false }` (see
 * `baseFields/sessions.js`: a citizen must never be able to inject a session id
 * into their own row via their `update: isAdminOrSelf` self-service access).
 * Writing here relies on the local API's default `overrideAccess: true`, which
 * — confirmed at `fields/hooks/beforeValidate/promise.js:216-217` — short-
 * circuits field-level `access[operation]` to `true` without even calling it.
 * Deliberate, not an oversight: this is server-only code, never reachable from
 * a citizen's own request.
 */
export const createCitizenSession = async (
  req: PayloadRequest,
  citizenId: number,
): Promise<string> => {
  const { payload } = req
  const citizen = await payload.findByID({ collection: 'citizens', id: citizenId, req })

  const sid = randomUUID()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + CITIZEN_SESSION_TTL_SECONDS * 1000)

  const sessions = removeExpiredSessions(citizen.sessions ?? [])
  sessions.push({ id: sid, createdAt: now.toISOString(), expiresAt: expiresAt.toISOString() })

  await payload.update({ collection: 'citizens', id: citizenId, data: { sessions }, req })

  const { token } = await jwtSign({
    fieldsToSign: { id: citizenId, sid },
    secret: payload.secret,
    tokenExpiration: CITIZEN_SESSION_TTL_SECONDS,
  })

  return generateCookie<false>({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    path: '/',
    sameSite: 'Lax',
    secure: isProduction,
    maxAge: CITIZEN_SESSION_TTL_SECONDS,
    returnCookieAsObject: false,
  })
}

/**
 * Only clears the cookie — does not by itself revoke the session server-side.
 * Callers that log a citizen out (`endpoints/citizenSession.ts`) MUST also
 * remove the matching `sid` from `citizen.sessions`, or the row accumulates
 * dead entries forever and the JWT — if somehow replayed — would still
 * validate until its 6-month expiry. The logout endpoint does both in one
 * place; this helper only ever appears alongside that removal, never alone.
 */
export const clearCitizenSessionCookie = (): string =>
  generateCookie<false>({
    name: COOKIE_NAME,
    value: '',
    httpOnly: true,
    path: '/',
    sameSite: 'Lax',
    secure: isProduction,
    expires: new Date(0),
    returnCookieAsObject: false,
  })

/**
 * Custom auth strategy for citizens, reading its own `citizen-token` cookie —
 * never Payload's shared `payload-token` cookie, which the admin panel's
 * built-in local-JWT strategy already occupies (see the plan's §1.2 for why
 * sharing it would collide). Tried before that shared strategy in
 * `payload.authStrategies` and simply returns `null` when its own cookie is
 * absent, letting execution fall through — the two compose without conflict.
 */
export const citizenSessionStrategy: AuthStrategy = {
  name: 'citizen-session',
  authenticate: async ({ headers, payload }) => {
    const token = parseCookies(headers).get(COOKIE_NAME)
    if (!token) return { user: null }

    try {
      const { payload: decoded } = await jwtVerify(token, new TextEncoder().encode(payload.secret))
      const id = decoded.id as number
      const sid = decoded.sid as string

      const citizen = await payload.findByID({ collection: 'citizens', id })
      const validSession = (citizen.sessions ?? []).some(
        (session) => session.id === sid && new Date(session.expiresAt) > new Date(),
      )
      if (!validSession) return { user: null }

      return {
        user: { ...citizen, collection: 'citizens', _strategy: 'citizen-session', _sid: sid },
      }
    } catch {
      // Expired/invalid/tampered JWT, or no citizen for the decoded id — never
      // throw out of a strategy, just report "not authenticated" like any
      // other anonymous request.
      return { user: null }
    }
  },
}

/**
 * Server-component helper — the shape `TopNav` and both write flows call to
 * check "is this visitor already a known, verified citizen?".
 */
export const getCitizen = async (payload: Payload, headers: Headers): Promise<Citizen | null> => {
  const { user } = await payload.auth({ headers })
  return user?.collection === 'citizens' ? (user as unknown as Citizen) : null
}

/**
 * What a CLIENT component is allowed to know about the signed-in citizen: the
 * email an action is keyed on, and the pseudo it is shown under. Resolved
 * server-side (so it survives a reload, unlike anything a modal holds) and
 * handed to `CitizenMenu`, `sign-modal.tsx` and `interpeller-modal.tsx` alike.
 *
 * Deliberately not the `Citizen` document: a prop on a client component is
 * serialised into the RSC payload and shipped to the browser, and the row
 * carries `sessions[]` (ids and expiries) plus every auth field Payload adds —
 * none of which any of those components render. `citizens` will keep growing;
 * this type is what stops that growth from leaking into every page.
 */
export type CitizenIdentity = { email: string; pseudo: string }

export const toCitizenIdentity = (citizen: Citizen): CitizenIdentity => ({
  email: citizen.email,
  pseudo: citizen.pseudo,
})
