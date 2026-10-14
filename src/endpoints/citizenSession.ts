import type { Endpoint, PayloadRequest } from 'payload'

import { clearCitizenSessionCookie } from '@/lib/citizenSession'

/**
 * `/logout` itself is reserved — Payload auto-registers it (and `/login`,
 * `/me`, `/refresh-token`…) on every auth-enabled collection regardless of
 * `disableLocalStrategy`, wired to the shared `payload-token` cookie this
 * project deliberately doesn't use for citizens. Hence `/session/logout`.
 *
 * `req.user` is already populated by the strategy chain before this handler
 * runs — no manual re-verification needed. `_sid` is the field the custom
 * strategy attaches (`citizenSession.ts`), mirroring Payload's own internal
 * convention (`strategies/jwt.js`'s `user._sid`).
 */
export const logoutCitizen: Endpoint = {
  path: '/session/logout',
  method: 'post',
  handler: async (req: PayloadRequest) => {
    const user = req.user as (PayloadRequest['user'] & { _sid?: string }) | null

    if (user?.collection === 'citizens' && user._sid) {
      const citizen = await req.payload.findByID({ collection: 'citizens', id: user.id, req })
      const sessions = (citizen.sessions ?? []).filter((session) => session.id !== user._sid)
      await req.payload.update({ collection: 'citizens', id: user.id, data: { sessions }, req })
    }

    return new Response(null, {
      status: 200,
      headers: { 'Set-Cookie': clearCitizenSessionCookie() },
    })
  },
}
