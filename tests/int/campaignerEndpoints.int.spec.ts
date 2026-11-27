import type { PayloadRequest } from 'payload'
import { afterAll, describe, expect, it, vi } from 'vitest'

import { campaignerEndpoints } from '@/endpoints/campaigners'

describe('campaigner endpoints when campaigner auth is disabled', () => {
  const endpoints = campaignerEndpoints(() => ({ method: null }))

  it('mounts the four endpoints', () => {
    expect(endpoints.map((e) => `${e.method} ${e.path}`).sort()).toEqual([
      'get /oidc/authorize',
      'get /oidc/callback',
      'post /oidc/backchannel-logout',
      'post /session/logout',
    ])
  })

  it.each(endpoints.map((e) => [`${e.method} ${e.path}`, e] as const))(
    '%s returns 404',
    async (_, endpoint) => {
      const req = new Request(`http://localhost:3000/api/campaigners${endpoint.path}`, {
        method: endpoint.method.toUpperCase(),
      }) as unknown as PayloadRequest
      const response = await endpoint.handler(req)
      expect(response.status).toBe(404)
      expect(response.headers.get('set-cookie')).toBeNull()
    },
  )
})

describe('campaigner authorize endpoint when the provider is unreachable', () => {
  // Per test file worker: nothing listens on port 1, so discovery fails with a real network error.
  const issuer = process.env.OIDC_ISSUER
  process.env.OIDC_ISSUER = 'http://127.0.0.1:1'
  afterAll(() => {
    process.env.OIDC_ISSUER = issuer
  })

  it('logs the failure and redirects to the login page with the provider error', async () => {
    const authorize = campaignerEndpoints().find((e) => e.path === '/oidc/authorize')!
    const error = vi.fn()
    const req = Object.assign(
      new Request(
        'http://localhost:3000/api/campaigners/oidc/authorize?returnTo=%2Ffr%2Fdashboard',
      ),
      { payload: { logger: { error }, secret: 'test-secret' } },
    ) as unknown as PayloadRequest

    const response = await authorize.handler(req)

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/fr/dashboard/login?error=provider')
    expect(response.headers.get('set-cookie')).toBeNull()
    expect(error).toHaveBeenCalledOnce()
  })
})
