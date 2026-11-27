import config from '@payload-config'
import { jwtVerify, SignJWT } from 'jose'
import * as oidcClient from 'openid-client'
import { getPayload, ValidationError, type Payload } from 'payload'

import { getCampaignerAuthConfig, type OidcConfig } from './campaignerAuthConfig'
import { getOidcClient, hasClientRole } from './campaignerOidc'
import {
  campaignerCookie,
  campaignerSecretKey,
  createCampaignerSession,
  tokenExpiries,
  type OidcTokenResponse,
} from './campaignerSession'
import { isLocale, type Locale } from './locale'

export type LoginErrorCode =
  'provider' | 'state' | 'email-missing' | 'email-unverified' | 'access-denied' | 'email-conflict'

type LoginResult =
  | { ok: true; returnTo: string; setCookies: string[] }
  | { ok: false; error: LoginErrorCode; lang: Locale; setCookies: string[] }

type Flow = { state: string; nonce: string; codeVerifier: string; returnTo: string }

const FLOW_COOKIE = 'campaigner-oidc'
const FLOW_TTL_SECONDS = 600
const FLOW_AUDIENCE = 'campaigner-oidc-flow'
const DEFAULT_RETURN_TO = '/fr/dashboard'

// Browsers strip tabs and newlines and read `\` as `/`, so `/\t/evil.com` and `/\evil.com`
// both leave the origin.
export const safeReturnTo = (value: string | null | undefined): string => {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return DEFAULT_RETURN_TO
  if (/[\\\x00-\x1f\x7f]/.test(value)) return DEFAULT_RETURN_TO
  return value
}

const requireOidc = (): OidcConfig => {
  const authConfig = getCampaignerAuthConfig()
  if (authConfig.method !== 'oidc') throw new Error('Campaigner login requires the oidc method')
  return authConfig.oidc
}

const flowCookie = (value: string, maxAge: number): string =>
  campaignerCookie(FLOW_COOKIE, value, maxAge)

export const startLogin = async (
  returnTo: string | null,
): Promise<{ redirectUrl: string; setCookie: string }> => {
  const oidc = requireOidc()
  const [client, payload] = await Promise.all([getOidcClient(), getPayload({ config })])

  const state = oidcClient.randomState()
  const nonce = oidcClient.randomNonce()
  const codeVerifier = oidcClient.randomPKCECodeVerifier()
  const flow: Flow = { state, nonce, codeVerifier, returnTo: safeReturnTo(returnTo) }

  const token = await new SignJWT(flow)
    .setProtectedHeader({ alg: 'HS256' })
    .setAudience(FLOW_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${FLOW_TTL_SECONDS}s`)
    .sign(campaignerSecretKey(payload.secret))

  const redirectUrl = oidcClient.buildAuthorizationUrl(client, {
    redirect_uri: oidc.redirectUri,
    scope: 'openid email profile',
    state,
    nonce,
    code_challenge: await oidcClient.calculatePKCECodeChallenge(codeVerifier),
    code_challenge_method: 'S256',
  })

  return { redirectUrl: redirectUrl.href, setCookie: flowCookie(token, FLOW_TTL_SECONDS) }
}

const readFlow = async (secret: string, token: string | undefined): Promise<Flow | null> => {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, campaignerSecretKey(secret), {
      audience: FLOW_AUDIENCE,
      algorithms: ['HS256'],
    })
    const { state, nonce, codeVerifier, returnTo } = payload
    if (
      typeof state !== 'string' ||
      typeof nonce !== 'string' ||
      typeof codeVerifier !== 'string' ||
      typeof returnTo !== 'string'
    ) {
      return null
    }
    return { state, nonce, codeVerifier, returnTo: safeReturnTo(returnTo) }
  } catch {
    return null
  }
}

const langOf = (returnTo: string | undefined): Locale => {
  const segment = returnTo?.split(/[/?#]/)[1] ?? ''
  return isLocale(segment) ? segment : 'fr'
}

type Identity = { issuer: string; subject: string; email: string; name: string | null }

const findByIdentity = async (payload: Payload, { issuer, subject }: Identity) =>
  (
    await payload.find({
      collection: 'campaigners',
      where: { and: [{ oidcIssuer: { equals: issuer } }, { oidcSubject: { equals: subject } }] },
      limit: 1,
      depth: 0,
      pagination: false,
    })
  ).docs[0] ?? null

const emailTakenByAnother = async (payload: Payload, email: string, selfId: number | null) =>
  (
    await payload.find({
      collection: 'campaigners',
      where: {
        and: [
          { email: { equals: email } },
          ...(selfId !== null ? [{ id: { not_equals: selfId } }] : []),
        ],
      },
      limit: 1,
      depth: 0,
      pagination: false,
    })
  ).docs.length > 0

const isFieldError = (error: unknown, path: string): boolean =>
  error instanceof ValidationError && error.data.errors.some((entry) => entry.path === path)

// The Postgres adapter tags the errors it converts from a unique violation with `tableName`;
// field validation (e.g. a malformed email) does not.
const isUniqueViolation = (error: unknown, path: string): boolean =>
  error instanceof ValidationError &&
  error.data.errors.some((entry) => entry.path === path && entry.tableName !== undefined)

const updateCampaigner = async (
  payload: Payload,
  id: number,
  identity: Identity,
): Promise<number | 'email-conflict'> => {
  if (await emailTakenByAnother(payload, identity.email, id)) return 'email-conflict'
  try {
    await payload.update({
      collection: 'campaigners',
      id,
      data: { email: identity.email, name: identity.name, lastLoginAt: new Date().toISOString() },
    })
    return id
  } catch (error) {
    if (isUniqueViolation(error, 'email')) return 'email-conflict'
    throw error
  }
}

const upsertCampaigner = async (
  payload: Payload,
  identity: Identity,
): Promise<number | 'email-conflict'> => {
  const existing = await findByIdentity(payload, identity)
  if (existing) return updateCampaigner(payload, existing.id, identity)

  if (await emailTakenByAnother(payload, identity.email, null)) return 'email-conflict'

  try {
    const created = await payload.create({
      collection: 'campaigners',
      data: {
        email: identity.email,
        name: identity.name,
        oidcIssuer: identity.issuer,
        oidcSubject: identity.subject,
        lastLoginAt: new Date().toISOString(),
      },
    })
    return created.id
  } catch (error) {
    // A concurrent first login for the same person won the email's unique index, or the
    // (iss, sub) hook if it ran after the winner committed.
    if (!isUniqueViolation(error, 'email') && !isFieldError(error, 'oidcSubject')) throw error
    const raced = await findByIdentity(payload, identity)
    return raced ? updateCampaigner(payload, raced.id, identity) : 'email-conflict'
  }
}

const tokensForSession = (tokens: OidcTokenResponse) => ({
  idToken: tokens.id_token!,
  refreshToken: tokens.refresh_token ?? null,
  ...tokenExpiries(tokens),
})

export const completeLogin = async (
  payload: Payload,
  search: string,
  flowCookieValue: string | undefined,
): Promise<LoginResult> => {
  const setCookies = [flowCookie('', 0)]
  const params = new URLSearchParams(search)
  const flow = await readFlow(payload.secret, flowCookieValue)
  const lang = langOf(flow?.returnTo)

  const refuse = (error: LoginErrorCode, detail: string): LoginResult => {
    const message = `Campaigner login refused (${error}): ${detail}`
    if (error === 'provider') payload.logger.error(message)
    else payload.logger.warn(message)
    return { ok: false, error, lang, setCookies }
  }

  const providerError = params.get('error')
  if (providerError) {
    return refuse(
      providerError === 'access_denied' ? 'access-denied' : 'provider',
      `provider returned ${providerError}: ${params.get('error_description') ?? 'no description'}`,
    )
  }

  if (!flow) return refuse('state', 'flow cookie missing, expired or invalid')
  if (params.get('state') !== flow.state) return refuse('state', 'state mismatch')

  try {
    const oidc = requireOidc()
    const client = await getOidcClient()

    const callbackUrl = new URL(oidc.redirectUri)
    callbackUrl.search = params.toString()

    let tokens: Awaited<ReturnType<typeof oidcClient.authorizationCodeGrant>>
    try {
      tokens = await oidcClient.authorizationCodeGrant(client, callbackUrl, {
        pkceCodeVerifier: flow.codeVerifier,
        expectedState: flow.state,
        expectedNonce: flow.nonce,
        idTokenExpected: true,
      })
    } catch (error) {
      return refuse('provider', error instanceof Error ? error.message : 'token exchange failed')
    }

    const claims = tokens.claims()!
    const email = typeof claims.email === 'string' ? claims.email.trim().toLowerCase() : ''
    if (!email) return refuse('email-missing', `no email claim for subject ${claims.sub}`)
    if (claims.email_verified !== true) {
      return refuse('email-unverified', `email not verified for subject ${claims.sub}`)
    }
    if (
      oidc.requiredRole &&
      !hasClientRole(tokens.access_token, oidc.clientId, oidc.requiredRole)
    ) {
      return refuse('access-denied', `role ${oidc.requiredRole} missing for subject ${claims.sub}`)
    }

    const campaignerId = await upsertCampaigner(payload, {
      issuer: claims.iss,
      subject: claims.sub,
      email,
      name: typeof claims.name === 'string' ? claims.name : null,
    })
    if (campaignerId === 'email-conflict') {
      return refuse(
        'email-conflict',
        `email already used by another campaigner (subject ${claims.sub})`,
      )
    }

    const sessionCookie = await createCampaignerSession(payload, campaignerId, {
      sid: typeof claims.sid === 'string' ? claims.sid : null,
      ...tokensForSession(tokens),
    })

    return { ok: true, returnTo: flow.returnTo, setCookies: [...setCookies, sessionCookie] }
  } catch (error) {
    return refuse('provider', error instanceof Error ? error.message : 'unexpected error')
  }
}
