import type { CollectionBeforeValidateHook, CollectionConfig } from 'payload'
import { ValidationError } from 'payload'

import { isAdmin, isCitizen, nobody } from '@/access'
import { decrementSignatureCounter, incrementSignatureCounter } from '@/hooks/counters'
import { toId } from '@/lib/relations'

/**
 * "Une même adresse email = une seule signature par pétition". Since a citizen is
 * keyed by a unique email, uniqueness on (petition, citizen) is the same rule.
 * Postgres has no compound unique constraint exposed through Payload, so it is
 * enforced here.
 */
const oneSignaturePerCitizen: CollectionBeforeValidateHook = async ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  if (operation !== 'create') return data

  const petition = toId(data?.petition ?? originalDoc?.petition)
  const citizen = toId(data?.citizen ?? originalDoc?.citizen)

  if (petition === undefined || citizen === undefined) return data

  const { totalDocs } = await req.payload.count({
    collection: 'petition-signatures',
    where: {
      and: [{ petition: { equals: petition } }, { citizen: { equals: citizen } }],
    },
    req,
  })

  if (totalDocs > 0) {
    throw new ValidationError(
      {
        collection: 'petition-signatures',
        errors: [{ path: 'citizen', message: 'This citizen has already signed this petition.' }],
      },
      req.t,
    )
  }

  return data
}

export const PetitionSignatures: CollectionConfig = {
  slug: 'petition-signatures',
  labels: { singular: 'Petition signature', plural: 'Petition signatures' },
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['citizen', 'petition', 'city', 'createdAt'],
    group: 'Citizens',
  },
  access: {
    // The public « Dernières signatures » list is served by the
    // /api/petitions/:id/recent-signatures endpoint, which exposes only
    // pseudo + city + date. Opening `read` here would expose citizen emails.
    read: isAdmin,
    create: isCitizen,
    update: nobody,
    delete: isAdmin,
  },
  hooks: {
    beforeValidate: [oneSignaturePerCitizen],
    afterChange: [incrementSignatureCounter],
    afterDelete: [decrementSignatureCounter],
  },
  fields: [
    {
      name: 'citizen',
      type: 'relationship',
      relationTo: 'citizens',
      required: true,
      index: true,
    },
    {
      name: 'petition',
      type: 'relationship',
      relationTo: 'petitions',
      required: true,
      index: true,
    },
    {
      name: 'city',
      type: 'text',
      admin: {
        description: 'Optional, shown on the public signature list. Asked on the signing form.',
      },
    },
    {
      name: 'responses',
      type: 'array',
      labels: { singular: 'Answer', plural: 'Responses' },
      fields: [
        {
          // Snapshot of the label as shown — not localized. See
          // InterpellationSubmissions.feedback[].label for the rationale.
          name: 'label',
          type: 'text',
          required: true,
        },
        {
          name: 'value',
          type: 'textarea',
        },
      ],
    },
  ],
}
