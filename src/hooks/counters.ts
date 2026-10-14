import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

import { incrementCounter } from '@/lib/counters'
import { toId } from '@/lib/relations'

/**
 * An interpellation submission moves two counters: the individual target's (shown
 * on their card, and the sort key for "moins sollicité·es") and the campaign total.
 */
export const incrementInterpellationCounters: CollectionAfterChangeHook = async ({
  doc,
  operation,
  req,
}) => {
  if (operation !== 'create') return doc

  await incrementCounter({
    req,
    collection: 'campaign-targets',
    column: 'submission_count',
    id: toId(doc.target),
  })
  await incrementCounter({
    req,
    collection: 'interpellations',
    column: 'submission_count',
    id: toId(doc.campaign),
  })

  return doc
}

export const decrementInterpellationCounters: CollectionAfterDeleteHook = async ({ doc, req }) => {
  await incrementCounter({
    req,
    by: -1,
    collection: 'campaign-targets',
    column: 'submission_count',
    id: toId(doc.target),
  })
  await incrementCounter({
    req,
    by: -1,
    collection: 'interpellations',
    column: 'submission_count',
    id: toId(doc.campaign),
  })

  return doc
}

export const incrementSignatureCounter: CollectionAfterChangeHook = async ({
  doc,
  operation,
  req,
}) => {
  if (operation !== 'create') return doc

  await incrementCounter({
    req,
    collection: 'petitions',
    column: 'signature_count',
    id: toId(doc.petition),
  })

  return doc
}

export const decrementSignatureCounter: CollectionAfterDeleteHook = async ({ doc, req }) => {
  await incrementCounter({
    req,
    by: -1,
    collection: 'petitions',
    column: 'signature_count',
    id: toId(doc.petition),
  })

  return doc
}
