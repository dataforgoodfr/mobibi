import type { Endpoint, PayloadRequest } from 'payload'
import { APIError } from 'payload'

import { listRecentSignatures } from '@/lib/signatures'

/**
 * Public « Dernières signatures » list.
 *
 * Exists so that `petition-signatures.read` can stay admin-only: the list needs
 * pseudo + city + date, and nothing else. Reading the collection directly would
 * expose citizen email addresses.
 */
export const recentSignatures: Endpoint = {
  path: '/:id/recent-signatures',
  method: 'get',
  handler: async (req: PayloadRequest) => {
    const petitionId = req.routeParams?.id

    if (!petitionId) throw new APIError('Missing petition id', 400)

    // Only for petitions the public can see.
    const petition = await req.payload
      .findByID({
        collection: 'petitions',
        id: petitionId as string,
        depth: 0,
        req,
        overrideAccess: false,
      })
      .catch(() => null)

    if (!petition) throw new APIError('Not found', 404)

    const limitParam = Number(new URL(req.url ?? '', 'http://localhost').searchParams.get('limit'))
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 50) : 10

    const docs = await listRecentSignatures(req.payload, petitionId as string, limit, req)

    return Response.json({ docs })
  },
}
