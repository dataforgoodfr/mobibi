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

// Each test file runs in its own worker with its own Payload pool: at pg's default of 10
// connections, one worker per core exhausts a local Postgres's max_connections of 100.
process.env.DATABASE_POOL_MAX = '3'

// Forced, not defaulted: a developer's `.env` points OIDC at a real Keycloak, and the
// int tests must only ever talk to the mock started on port 4010.
const campaignerAuthTestEnv = {
  CAMPAIGNER_AUTH_METHOD: 'oidc',
  OIDC_ISSUER: 'http://localhost:4010',
  OIDC_CLIENT_ID: 'mobibi',
  OIDC_CLIENT_SECRET: 'test-secret',
  OIDC_REQUIRED_ROLE: 'access',
  PAYLOAD_PUBLIC_SERVER_URL: 'http://localhost:3000',
}

Object.assign(process.env, campaignerAuthTestEnv)
