import { decodeJwt } from 'jose'
import * as client from 'openid-client'

import { getCampaignerAuthConfig } from './campaignerAuthConfig'

const REQUEST_TIMEOUT_MS = 10_000

let configuration: Promise<client.Configuration> | null = null

const discover = async (): Promise<client.Configuration> => {
  const config = getCampaignerAuthConfig()
  if (config.method !== 'oidc') {
    throw new Error('getOidcClient() requires CAMPAIGNER_AUTH_METHOD=oidc')
  }

  const { issuer, clientId, clientSecret } = config.oidc
  const issuerUrl = new URL(issuer)
  return client.discovery(issuerUrl, clientId, clientSecret, undefined, {
    [client.customFetch]: (url, options) =>
      fetch(url, { ...options, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }),
    execute: issuerUrl.protocol === 'http:' ? [client.allowInsecureRequests] : [],
  })
}

export const getOidcClient = (): Promise<client.Configuration> => {
  if (!configuration) {
    const pending = discover()
    configuration = pending
    pending.catch(() => {
      if (configuration === pending) configuration = null
    })
  }
  return configuration
}

export const hasClientRole = (accessToken: string, clientId: string, role: string): boolean => {
  try {
    const { resource_access } = decodeJwt(accessToken)
    const roles = (resource_access as Record<string, { roles?: unknown }> | undefined)?.[clientId]
      ?.roles
    return Array.isArray(roles) && roles.includes(role)
  } catch {
    return false
  }
}
