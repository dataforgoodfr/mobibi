import { sql } from 'drizzle-orm'
import type { PayloadRequest } from 'payload'

import { getDb } from '@/lib/db'

type CounterCollection = 'campaign-targets' | 'interpellations' | 'petitions'

/** Payload's Postgres adapter names tables after the collection slug, snake_cased. */
const tableName = (collection: CounterCollection): string => collection.replace(/-/g, '_')

/**
 * Atomically add `by` to a counter column.
 *
 * Deliberately raw SQL rather than `payload.update({ count: doc.count + 1 })`:
 * a read-modify-write loses increments when two citizens act at the same time,
 * and a counter is the entire point of this product. `SET col = col + n` takes a
 * row lock and re-reads inside it, so concurrent increments serialise correctly.
 *
 * Bypassing the document layer also means no hook re-entry, so no `context` flag
 * is needed to prevent loops.
 */
export const incrementCounter = async ({
  by = 1,
  collection,
  column,
  id,
  req,
}: {
  by?: number
  collection: CounterCollection
  column: 'submission_count' | 'signature_count'
  id: number | string | undefined
  req: PayloadRequest
}): Promise<void> => {
  if (id === undefined) return

  const table = sql.identifier(tableName(collection))
  const col = sql.identifier(column)

  await getDb(req).execute(
    sql`UPDATE ${table} SET ${col} = GREATEST(COALESCE(${col}, 0) + ${by}, 0) WHERE id = ${id}`,
  )
}
