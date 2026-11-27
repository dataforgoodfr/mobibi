import { parseCookies, type Endpoint, type PayloadRequest } from 'payload'

import { getCampaignerAuthConfig, type CampaignerAuthConfig } from '@/lib/campaignerAuthConfig'
import { backchannelLogout } from '@/lib/campaignerBackchannel'
import { completeLogin, FLOW_COOKIE, langOf, safeReturnTo, startLogin } from '@/lib/campaignerLogin'
import { logoutCampaigner } from '@/lib/campaignerSession'

type Handler = (req: PayloadRequest) => Promise<Response>

const redirect = (status: 302 | 303, location: string, cookies: string[]): Response => {
  const headers = new Headers({ Location: location })
  for (const cookie of cookies) headers.append('Set-Cookie', cookie)
  return new Response(null, { status, headers })
}

const readFormParam = async (req: PayloadRequest, name: string): Promise<string | null> => {
  try {
    return new URLSearchParams((await req.text?.()) ?? '').get(name)
  } catch {
    return null
  }
}

const authorize: Handler = async (req) => {
  const returnTo = new URL(req.url ?? '', 'http://localhost').searchParams.get('returnTo')
  try {
    const { redirectUrl, setCookie } = await startLogin(req.payload, returnTo)
    return redirect(302, redirectUrl, [setCookie])
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'unknown error'
    req.payload.logger.error(`Campaigner login could not start: ${detail}`)
    return redirect(302, `/${langOf(safeReturnTo(returnTo))}/dashboard/login?error=provider`, [])
  }
}

const callback: Handler = async (req) => {
  const { search } = new URL(req.url ?? '', 'http://localhost')
  const flowCookie = req.headers ? parseCookies(req.headers).get(FLOW_COOKIE) : undefined
  const result = await completeLogin(req.payload, search, flowCookie)
  const location = result.ok
    ? result.returnTo
    : `/${result.lang}/dashboard/login?error=${result.error}`
  return redirect(302, location, result.setCookies)
}

const logout: Handler = async (req) => {
  const { redirectUrl, setCookie } = await logoutCampaigner(
    req.payload,
    req.headers ?? new Headers(),
  )
  return redirect(303, redirectUrl, [setCookie])
}

const backchannel: Handler = async (req) => {
  const logoutToken = await readFormParam(req, 'logout_token')
  const ok = logoutToken ? await backchannelLogout(req.payload, logoutToken) : false
  return new Response(null, { status: ok ? 200 : 400, headers: { 'Cache-Control': 'no-store' } })
}

export const campaignerEndpoints = (
  getConfig: () => CampaignerAuthConfig = getCampaignerAuthConfig,
): Endpoint[] => {
  const whenEnabled =
    (handler: Handler): Handler =>
    (req) =>
      getConfig().method === 'oidc'
        ? handler(req)
        : Promise.resolve(new Response(null, { status: 404 }))

  return [
    { path: '/oidc/authorize', method: 'get', handler: whenEnabled(authorize) },
    { path: '/oidc/callback', method: 'get', handler: whenEnabled(callback) },
    { path: '/session/logout', method: 'post', handler: whenEnabled(logout) },
    { path: '/oidc/backchannel-logout', method: 'post', handler: whenEnabled(backchannel) },
  ]
}
