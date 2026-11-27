import { createRemoteJWKSet, errors, jwtVerify, type JWTPayload } from 'jose'
import type { Payload, Where } from 'payload'

import { getCampaignerAuthConfig } from './campaignerAuthConfig'
import { getOidcClient } from './campaignerOidc'

const BACKCHANNEL_LOGOUT_EVENT = 'http://schemas.openid.net/event/backchannel-logout'

const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>()

const keySetFor = (jwksUri: string) => {
  let keySet = keySets.get(jwksUri)
  if (!keySet) {
    keySet = createRemoteJWKSet(new URL(jwksUri))
    keySets.set(jwksUri, keySet)
  }
  return keySet
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const asNonEmptyString = (value: unknown): string | null =>
  typeof value === 'string' && value !== '' ? value : null

type LogoutClaims = { issuer: string; sid: string | null; sub: string | null }

type Verification = { ok: true; claims: LogoutClaims } | { ok: false; reason: string }

const reasonOf = (error: unknown): string => {
  if (error instanceof errors.JWTClaimValidationFailed) {
    return `${error.code} (${error.claim}: ${error.reason})`
  }
  if (error instanceof errors.JOSEError) return error.code
  return error instanceof Error ? error.message : 'unknown error'
}

// OpenID Connect Back-Channel Logout 1.0, section 2.6.
const verifyLogoutToken = async (logoutToken: string): Promise<Verification> => {
  const config = getCampaignerAuthConfig()
  if (config.method !== 'oidc') throw new Error('Back-channel logout requires the oidc method')

  const metadata = (await getOidcClient()).serverMetadata()
  if (!metadata.jwks_uri) throw new Error('The OIDC provider publishes no jwks_uri')

  let claims: JWTPayload
  try {
    // The discovered issuer, not the configured URL: it is what `oidcIssuer` was stored from.
    ;({ payload: claims } = await jwtVerify(logoutToken, keySetFor(metadata.jwks_uri), {
      issuer: metadata.issuer,
      audience: config.oidc.clientId,
      algorithms: ['RS256', 'ES256', 'PS256'],
      maxTokenAge: '2 minutes',
      clockTolerance: '30s',
    }))
  } catch (error) {
    return { ok: false, reason: reasonOf(error) }
  }

  if (!isObject(claims.events) || !isObject(claims.events[BACKCHANNEL_LOGOUT_EVENT])) {
    return { ok: false, reason: 'events claim lacks the back-channel logout event' }
  }
  if ('nonce' in claims) return { ok: false, reason: 'nonce claim present' }

  const sid = asNonEmptyString(claims.sid)
  const sub = asNonEmptyString(claims.sub)
  if (!sid && !sub) return { ok: false, reason: 'neither sid nor sub claim' }

  return { ok: true, claims: { issuer: metadata.issuer, sid, sub } }
}

/** False when the token is invalid; an unknown `sid` or `sub` is a success that deletes nothing. */
export const backchannelLogout = async (
  payload: Payload,
  logoutToken: string,
): Promise<boolean> => {
  const verification = await verifyLogoutToken(logoutToken)
  if (!verification.ok) {
    payload.logger.warn(`Back-channel logout rejected: ${verification.reason}`)
    return false
  }
  const { claims } = verification

  const conditions: Where[] = [{ 'campaigner.oidcIssuer': { equals: claims.issuer } }]
  if (claims.sid) conditions.push({ oidcSid: { equals: claims.sid } })
  if (claims.sub) conditions.push({ 'campaigner.oidcSubject': { equals: claims.sub } })

  await payload.delete({ collection: 'campaigner-sessions', where: { and: conditions } })
  return true
}
