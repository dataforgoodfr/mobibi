// Load .env files
import 'dotenv/config'

/**
 * Point every test at a dedicated database.
 *
 * Integration tests write real rows through the Local API, so they must never
 * reach the development database — a failed test leaves fixtures behind, and a
 * broad `payload.delete({ where })` would take the seed data with it.
 *
 * This runs before any test file imports `payload.config`, which reads
 * `DATABASE_URL` at import time.
 */
const testDatabaseUrl = process.env.DATABASE_URL_TEST

if (!testDatabaseUrl) {
  throw new Error(
    'DATABASE_URL_TEST is not set. Copy it from .env.example into .env and create the database.',
  )
}

process.env.DATABASE_URL = testDatabaseUrl
