export type OidcConfig = {
  issuer: string
  clientId: string
  clientSecret: string
  requiredRole: string | null
  redirectUri: string
  postLogoutRedirectUri: string
  backchannelLogoutUri: string
}

export type CampaignerAuthConfig = { method: null } | { method: 'oidc'; oidc: OidcConfig }

export class CampaignerAuthConfigError extends Error {}

const REQUIRED_OIDC_VARIABLES = [
  'OIDC_ISSUER',
  'OIDC_CLIENT_ID',
  'OIDC_CLIENT_SECRET',
  'PAYLOAD_PUBLIC_SERVER_URL',
] as const

export const parseCampaignerAuthConfig = (
  env: Record<string, string | undefined>,
): CampaignerAuthConfig => {
  const method = env.CAMPAIGNER_AUTH_METHOD || null

  if (method === null) return { method: null }

  if (method === 'magic-link') {
    throw new CampaignerAuthConfigError(
      'CAMPAIGNER_AUTH_METHOD=magic-link is not implemented yet. Use oidc, or unset it.',
    )
  }

  if (method !== 'oidc') {
    throw new CampaignerAuthConfigError(
      `CAMPAIGNER_AUTH_METHOD="${method}" is not supported. Use oidc, or unset it.`,
    )
  }

  const missing = REQUIRED_OIDC_VARIABLES.filter((name) => !env[name])
  if (missing.length > 0) {
    throw new CampaignerAuthConfigError(
      `CAMPAIGNER_AUTH_METHOD=oidc requires ${missing.join(', ')}.`,
    )
  }

  const origin = env.PAYLOAD_PUBLIC_SERVER_URL!.replace(/\/+$/, '')

  return {
    method: 'oidc',
    oidc: {
      issuer: env.OIDC_ISSUER!,
      clientId: env.OIDC_CLIENT_ID!,
      clientSecret: env.OIDC_CLIENT_SECRET!,
      requiredRole: env.OIDC_REQUIRED_ROLE || null,
      redirectUri: `${origin}/api/campaigners/oidc/callback`,
      postLogoutRedirectUri: `${origin}/`,
      backchannelLogoutUri: `${origin}/api/campaigners/oidc/backchannel-logout`,
    },
  }
}

let cached: CampaignerAuthConfig | undefined

export const getCampaignerAuthConfig = (): CampaignerAuthConfig => {
  cached ??= parseCampaignerAuthConfig(process.env)
  return cached
}
