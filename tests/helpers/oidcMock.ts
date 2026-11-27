import { randomUUID } from 'node:crypto'

import { importJWK, SignJWT } from 'jose'
import { OAuth2Server } from 'oauth2-mock-server'

export type MockUser = {
  sub: string
  email?: string
  email_verified?: boolean
  name?: string
  roles?: string[]
  sid?: string
}

export type OidcMock = {
  issuer: string
  setUser(user: MockUser): void
  tamperIdToken(patch: Record<string, unknown>): void
  failNextRefresh(): void
  patchNextRefresh(body: Record<string, unknown>): void
  refreshCount(): number
  authorizeCode(authorizationUrl: string): Promise<URL>
  buildLogoutToken(claims: Record<string, unknown>): Promise<string>
  stop(): Promise<void>
}

const CLIENT_ID = 'mobibi'

export const startOidcMock = async (port: number): Promise<OidcMock> => {
  const server = new OAuth2Server()
  await server.issuer.keys.generate('RS256')
  await server.start(port, 'localhost')

  const issuer = server.issuer.url!.replace(/\/$/, '')
  let user: MockUser = { sub: 'johndoe' }
  let idTokenPatch: Record<string, unknown> | null = null
  let refreshCalls = 0
  let refreshArmed = false
  let refreshPatch: Record<string, unknown> | null = null

  server.service.on('beforeTokenSigning', (token) => {
    const { payload } = token
    // The mock stamps `amr` on access tokens only; the id token carries just sub and aud.
    const isAccessToken = 'amr' in payload
    payload.sub = user.sub

    if (isAccessToken) {
      payload.resource_access = { [CLIENT_ID]: { roles: user.roles ?? [] } }
      return
    }

    if (user.email !== undefined) payload.email = user.email
    if (user.email_verified !== undefined) payload.email_verified = user.email_verified
    if (user.name !== undefined) payload.name = user.name
    if (user.sid !== undefined) payload.sid = user.sid
    if (idTokenPatch) {
      Object.assign(payload, idTokenPatch)
      idTokenPatch = null
    }
  })

  server.service.on('beforeResponse', (response, req) => {
    if (req.body.grant_type !== 'refresh_token') return
    refreshCalls += 1
    if (refreshPatch) {
      Object.assign(response.body as Record<string, unknown>, refreshPatch)
      refreshPatch = null
    }
    if (!refreshArmed) return
    refreshArmed = false
    response.statusCode = 400
    response.body = { error: 'invalid_grant' }
  })

  return {
    issuer,
    setUser: (next) => {
      user = next
    },
    tamperIdToken: (patch) => {
      idTokenPatch = patch
    },
    failNextRefresh: () => {
      refreshArmed = true
    },
    patchNextRefresh: (body) => {
      refreshPatch = body
    },
    refreshCount: () => refreshCalls,
    authorizeCode: async (authorizationUrl) => {
      const response = await fetch(authorizationUrl, { redirect: 'manual' })
      const location = response.headers.get('location')
      if (!location) throw new Error(`Mock /authorize did not redirect (status ${response.status})`)
      return new URL(location)
    },
    buildLogoutToken: async (claims) => {
      const jwk = server.issuer.keys.get()!
      const key = await importJWK(jwk, 'RS256')
      return new SignJWT({
        iss: issuer,
        iat: Math.floor(Date.now() / 1000),
        jti: randomUUID(),
        ...claims,
      })
        .setProtectedHeader({ alg: 'RS256', kid: jwk.kid })
        .sign(key)
    },
    stop: () => server.stop(),
  }
}
