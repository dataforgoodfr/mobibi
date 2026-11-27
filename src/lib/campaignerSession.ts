import { SignJWT } from 'jose'
import { generateCookie, type Payload } from 'payload'

import { encryptSecret } from './secretBox'

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
