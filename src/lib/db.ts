import type { Payload, PayloadRequest } from 'payload'

export type DrizzleLike = { execute: (query: unknown) => Promise<unknown> }

type DrizzleAdapter = {
  drizzle: DrizzleLike
  sessions?: Record<string, { db?: DrizzleLike }>
}

/** The pooled Drizzle handle, for raw SQL that runs outside any request transaction. */
export const getDrizzleDb = (payload: Payload): DrizzleLike =>
  (payload.db as unknown as DrizzleAdapter).drizzle

/**
 * Resolve the Drizzle handle bound to the current transaction, so a raw-SQL
 * write commits or rolls back together with the rest of the request. Falls
 * back to the pooled handle when the operation runs outside a transaction.
 *
 * Shared by `lib/counters.ts` (counter increments) and `lib/magicLink.ts`
 * (the atomic single-use claim on a magic link) — both need raw SQL for the
 * same reason: a read-modify-write loses updates under concurrency.
 */
export const getDb = (req: PayloadRequest): DrizzleLike => {
  if (req.transactionID !== undefined) {
    const adapter = req.payload.db as unknown as DrizzleAdapter
    const session = adapter.sessions?.[String(req.transactionID)]
    if (session?.db) return session.db
  }

  return getDrizzleDb(req.payload)
}
