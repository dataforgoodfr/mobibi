import { sql } from 'drizzle-orm'
import { jwtVerify, SignJWT } from 'jose'
import * as oidcClient from 'openid-client'
import { generateCookie, NotFound, parseCookies, type Payload } from 'payload'

import type { Campaigner, CampaignerSession } from '@/payload-types'

import { getCampaignerAuthConfig } from './campaignerAuthConfig'
import { getOidcClient, hasClientRole } from './campaignerOidc'
import { getDrizzleDb } from './db'
import { decryptSecret, encryptSecret } from './secretBox'

const COOKIE_NAME = 'campaigner-token'
// Same secret signs the citizen and flow cookies: the audience stops one being replayed as another.
export const CAMPAIGNER_SESSION_AUDIENCE = 'campaigner-session'
// The cookie is never rewritten on refresh, so it carries the longest a session may live;
// the row's sliding `expiresAt` decides whether it is still valid.
export const CAMPAIGNER_SESSION_MAX_LIFETIME_SECONDS = 12 * 60 * 60

const isProduction = process.env.NODE_ENV === 'production'

export const campaignerSecretKey = (secret: string): Uint8Array => new TextEncoder().encode(secret)

/** `maxAge` of 0 clears the cookie. */
export const campaignerCookie = (name: string, value: string, maxAge: number): string =>
  generateCookie<false>({
    name,
    value,
    httpOnly: true,
    path: '/',
    sameSite: 'Lax',
    secure: isProduction,
    ...(maxAge > 0 ? { maxAge } : { expires: new Date(0) }),
    returnCookieAsObject: false,
  })

export type OidcSessionTokens = {
  sid: string | null
  idToken: string
  refreshToken: string | null
  accessTokenExpiresAt: Date | null
  refreshExpiresAt: Date | null
}

export type OidcTokenResponse = oidcClient.TokenEndpointResponse & {
  expiresIn(): number | undefined
}

export const tokenExpiries = (
  tokens: OidcTokenResponse,
  now = Date.now(),
): Pick<OidcSessionTokens, 'accessTokenExpiresAt' | 'refreshExpiresAt'> => {
  const expiresIn = tokens.expiresIn()
  const refreshExpiresIn = tokens.refresh_expires_in
  return {
    accessTokenExpiresAt: expiresIn !== undefined ? new Date(now + expiresIn * 1000) : null,
    refreshExpiresAt:
      typeof refreshExpiresIn === 'number' && refreshExpiresIn > 0
        ? new Date(now + refreshExpiresIn * 1000)
        : null,
  }
}

export const createCampaignerSession = async (
  payload: Payload,
  campaignerId: number,
  oidc: OidcSessionTokens | null,
): Promise<string> => {
  const cookieExpiresAt = new Date(Date.now() + CAMPAIGNER_SESSION_MAX_LIFETIME_SECONDS * 1000)
  const refreshExpiresAt = oidc?.refreshExpiresAt
  const expiresAt =
    refreshExpiresAt && refreshExpiresAt < cookieExpiresAt ? refreshExpiresAt : cookieExpiresAt

  const session = await payload.create({
    collection: 'campaigner-sessions',
    data: {
      campaigner: campaignerId,
      expiresAt: expiresAt.toISOString(),
      oidcSid: oidc?.sid ?? null,
      idToken: oidc?.idToken ?? null,
      refreshToken: oidc?.refreshToken ? encryptSecret(oidc.refreshToken, payload.secret) : null,
      accessTokenExpiresAt: oidc?.accessTokenExpiresAt?.toISOString() ?? null,
    },
  })

  const token = await new SignJWT({ sid: session.id })
    .setProtectedHeader({ alg: 'HS256' })
    .setAudience(CAMPAIGNER_SESSION_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(cookieExpiresAt)
    .sign(campaignerSecretKey(payload.secret))

  return campaignerCookie(COOKIE_NAME, token, CAMPAIGNER_SESSION_MAX_LIFETIME_SECONDS)
}

export const clearCampaignerSessionCookie = (): string => campaignerCookie(COOKIE_NAME, '', 0)

const deleteSession = async (payload: Payload, id: number): Promise<null> => {
  // By `where`, so a row a concurrent logout already removed is not an error.
  await payload.delete({ collection: 'campaigner-sessions', where: { id: { equals: id } } })
  return null
}

const readSessionId = async (payload: Payload, headers: Headers): Promise<number | null> => {
  const token = parseCookies(headers).get(COOKIE_NAME)
  if (!token) return null
  try {
    const { payload: claims } = await jwtVerify(token, campaignerSecretKey(payload.secret), {
      audience: CAMPAIGNER_SESSION_AUDIENCE,
      algorithms: ['HS256'],
    })
    return typeof claims.sid === 'number' ? claims.sid : null
  } catch {
    return null
  }
}

/** The session row behind the cookie, without refreshing it; an expired row is deleted. */
export const readCampaignerSession = async (
  payload: Payload,
  headers: Headers,
): Promise<CampaignerSession | null> => {
  const id = await readSessionId(payload, headers)
  if (id === null) return null

  const session = await payload.findByID({
    collection: 'campaigner-sessions',
    id,
    depth: 1,
    disableErrors: true,
  })
  if (!session) return null
  if (new Date(session.expiresAt) <= new Date()) return deleteSession(payload, session.id)
  return session
}

// The 30-second window outlasts the provider call's 10-second timeout, so no second request
// can claim the same refresh token while the first is still waiting on it.
const claimRefresh = async (payload: Payload, id: number): Promise<string | null> => {
  const result = await getDrizzleDb(payload).execute(
    sql`UPDATE campaigner_sessions
        SET access_token_expires_at = now() + interval '30 seconds'
        WHERE id = ${id} AND refresh_token IS NOT NULL
          AND (access_token_expires_at IS NULL OR access_token_expires_at < now())
        RETURNING refresh_token`,
  )
  const rows = (Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows) as
    { refresh_token: string }[] | undefined
  return rows?.[0]?.refresh_token ?? null
}

const isRevocation = (error: unknown): boolean =>
  error instanceof oidcClient.ResponseBodyError && error.error === 'invalid_grant'

const refreshSession = async (
  payload: Payload,
  session: CampaignerSession,
  sealedRefreshToken: string,
): Promise<boolean> => {
  const config = getCampaignerAuthConfig()
  if (config.method !== 'oidc') throw new Error('Refreshing a campaigner session requires oidc')
  const { clientId, requiredRole } = config.oidc

  const tokens = await oidcClient.refreshTokenGrant(
    await getOidcClient(),
    decryptSecret(sealedRefreshToken, payload.secret),
  )

  if (requiredRole && !hasClientRole(tokens.access_token, clientId, requiredRole)) {
    payload.logger.warn(`Campaigner session ${session.id} revoked: role ${requiredRole} missing`)
    await deleteSession(payload, session.id)
    return false
  }

  const { accessTokenExpiresAt, refreshExpiresAt } = tokenExpiries(tokens)
  const cap = new Date(session.createdAt).getTime() + CAMPAIGNER_SESSION_MAX_LIFETIME_SECONDS * 1000
  const slid = refreshExpiresAt?.getTime() ?? new Date(session.expiresAt).getTime()

  await payload.update({
    collection: 'campaigner-sessions',
    id: session.id,
    data: {
      expiresAt: new Date(Math.min(slid, cap)).toISOString(),
      accessTokenExpiresAt: accessTokenExpiresAt?.toISOString() ?? null,
      ...(tokens.refresh_token
        ? { refreshToken: encryptSecret(tokens.refresh_token, payload.secret) }
        : {}),
      ...(tokens.id_token ? { idToken: tokens.id_token } : {}),
    },
  })
  return true
}

export const getCampaigner = async (
  payload: Payload,
  headers: Headers,
): Promise<Campaigner | null> => {
  const session = await readCampaignerSession(payload, headers)
  if (!session) return null

  const { campaigner } = session
  if (!campaigner || typeof campaigner !== 'object') return deleteSession(payload, session.id)

  const accessTokenExpiresAt = session.accessTokenExpiresAt
    ? new Date(session.accessTokenExpiresAt)
    : null
  if (!session.refreshToken || (accessTokenExpiresAt && accessTokenExpiresAt > new Date())) {
    return campaigner
  }

  // No claim means another request holds the refresh; the access token only ever gates the
  // role check, so serving this one meanwhile is safe.
  const sealedRefreshToken = await claimRefresh(payload, session.id)
  // Null also when the row was just deleted; the next request then settles it.
  if (!sealedRefreshToken) return campaigner

  try {
    return (await refreshSession(payload, session, sealedRefreshToken)) ? campaigner : null
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'unknown error'
    const message = `Campaigner session ${session.id} refresh failed: ${detail}`
    // NotFound: a concurrent logout deleted the row before the write-back.
    if (isRevocation(error) || error instanceof NotFound) payload.logger.warn(message)
    else payload.logger.error(message)
    return deleteSession(payload, session.id)
  }
}

/** Ends the local session and returns where to send the browser to end the provider's. */
export const logoutCampaigner = async (
  payload: Payload,
  headers: Headers,
): Promise<{ redirectUrl: string; setCookie: string }> => {
  const config = getCampaignerAuthConfig()
  if (config.method !== 'oidc') throw new Error('Campaigner logout requires the oidc method')
  const { postLogoutRedirectUri } = config.oidc

  const session = await readCampaignerSession(payload, headers)
  if (session) await deleteSession(payload, session.id)

  const result = (redirectUrl: string) => ({
    redirectUrl,
    setCookie: clearCampaignerSessionCookie(),
  })
  if (!session?.idToken) return result(postLogoutRedirectUri)

  try {
    const client = await getOidcClient()
    if (!client.serverMetadata().end_session_endpoint) return result(postLogoutRedirectUri)
    const url = oidcClient.buildEndSessionUrl(client, {
      id_token_hint: session.idToken,
      post_logout_redirect_uri: postLogoutRedirectUri,
    })
    return result(url.href)
  } catch (error) {
    // The local session is already gone; an unreachable provider must not keep the user stuck.
    const detail = error instanceof Error ? error.message : 'unknown error'
    payload.logger.error(`Campaigner logout could not reach the provider: ${detail}`)
    return result(postLogoutRedirectUri)
  }
}
