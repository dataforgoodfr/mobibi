import { describe, expect, it } from 'vitest'

import { CampaignerAuthConfigError, parseCampaignerAuthConfig } from '@/lib/campaignerAuthConfig'

const completeEnv = {
  CAMPAIGNER_AUTH_METHOD: 'oidc',
  OIDC_ISSUER: 'https://auth.example.org/realms/democratie',
  OIDC_CLIENT_ID: 'mobibi',
  OIDC_CLIENT_SECRET: 'secret',
  PAYLOAD_PUBLIC_SERVER_URL: 'https://mobibi.example.org/',
}

describe('parseCampaignerAuthConfig', () => {
  it('disables campaigners when no method is set', () => {
    expect(parseCampaignerAuthConfig({})).toEqual({ method: null })
  })

  it('rejects an unknown method', () => {
    const parse = () => parseCampaignerAuthConfig({ CAMPAIGNER_AUTH_METHOD: 'saml' })
    expect(parse).toThrow(CampaignerAuthConfigError)
    expect(parse).toThrow(/CAMPAIGNER_AUTH_METHOD.*saml/)
  })

  it('refuses magic-link, which is not implemented yet', () => {
    expect(() => parseCampaignerAuthConfig({ CAMPAIGNER_AUTH_METHOD: 'magic-link' })).toThrow(
      /magic-link.*not implemented/i,
    )
  })

  it.each(['OIDC_ISSUER', 'OIDC_CLIENT_ID', 'OIDC_CLIENT_SECRET', 'PAYLOAD_PUBLIC_SERVER_URL'])(
    'requires %s',
    (name) => {
      const env: Record<string, string | undefined> = { ...completeEnv }
      delete env[name]
      expect(() => parseCampaignerAuthConfig(env)).toThrow(CampaignerAuthConfigError)
      expect(() => parseCampaignerAuthConfig(env)).toThrow(name)
    },
  )

  it('treats an empty string as missing', () => {
    expect(() => parseCampaignerAuthConfig({ ...completeEnv, OIDC_ISSUER: '' })).toThrow(
      'OIDC_ISSUER',
    )
  })

  it('derives the callback URIs from the server URL', () => {
    const config = parseCampaignerAuthConfig(completeEnv)
    expect(config).toMatchObject({
      method: 'oidc',
      oidc: {
        issuer: completeEnv.OIDC_ISSUER,
        clientId: 'mobibi',
        clientSecret: 'secret',
        requiredRole: null,
        redirectUri: 'https://mobibi.example.org/api/campaigners/oidc/callback',
        postLogoutRedirectUri: 'https://mobibi.example.org/',
        backchannelLogoutUri: 'https://mobibi.example.org/api/campaigners/oidc/backchannel-logout',
      },
    })
  })

  it('reads the required role, empty meaning none', () => {
    const withRole = parseCampaignerAuthConfig({ ...completeEnv, OIDC_REQUIRED_ROLE: 'access' })
    expect(withRole).toMatchObject({ oidc: { requiredRole: 'access' } })
    const empty = parseCampaignerAuthConfig({ ...completeEnv, OIDC_REQUIRED_ROLE: '' })
    expect(empty).toMatchObject({ oidc: { requiredRole: null } })
  })
})
