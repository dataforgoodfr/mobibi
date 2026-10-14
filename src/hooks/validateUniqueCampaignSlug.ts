import type { CollectionBeforeValidateHook } from 'payload'
import { ValidationError } from 'payload'

import { toId } from '@/lib/relations'

export type CampaignCollection = 'interpellations' | 'petitions'

const CAMPAIGN_COLLECTIONS: CampaignCollection[] = ['interpellations', 'petitions']

/**
 * `(organization, slug)` must be unique across BOTH campaign collections, because
 * the public route `/:organization/:slug` resolves to either type. No single
 * collection's `unique: true` can express a constraint that spans two tables, so
 * it is enforced here.
 */
export const validateUniqueCampaignSlug =
  (self: CampaignCollection): CollectionBeforeValidateHook =>
  async ({ data, originalDoc, req }) => {
    const slug = data?.slug ?? originalDoc?.slug
    const organization = toId(data?.organization ?? originalDoc?.organization)

    if (!slug || organization === undefined) return data

    for (const collection of CAMPAIGN_COLLECTIONS) {
      const { docs } = await req.payload.find({
        collection,
        where: {
          and: [{ slug: { equals: slug } }, { organization: { equals: organization } }],
        },
        // 2, not 1: on an update the document itself matches, and we still need
        // to see whether anything else does.
        limit: 2,
        depth: 0,
        req,
      })

      const clash = docs.find(
        (doc) =>
          !(collection === self && originalDoc?.id !== undefined && doc.id === originalDoc.id),
      )

      if (clash) {
        throw new ValidationError(
          {
            collection: self,
            errors: [
              {
                path: 'slug',
                message: `The slug "${slug}" is already used by ${
                  collection === self ? 'another campaign' : `a ${collection.replace(/s$/, '')}`
                } in this organization.`,
              },
            ],
          },
          req.t,
        )
      }
    }

    return data
  }
