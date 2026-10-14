import { defineConfig, devices } from '@playwright/test'

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
import 'dotenv/config'

/**
 * E2E tests run against the test database, never the development one.
 *
 * Two processes need the override, not one:
 *  1. this process — `tests/helpers/seedUser.ts` creates the admin user through
 *     the Local API directly, without going via the server;
 *  2. the Next server started by `webServer` below.
 *
 * If only the server were switched, the seeded user would land in the
 * development database while the browser logs into a server backed by the test
 * one, and every admin test would fail at login.
 */
const databaseUrl = process.env.DATABASE_URL_TEST

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL_TEST is not set. Copy it from .env.example into .env and create the database.',
  )
}

process.env.DATABASE_URL = databaseUrl

const baseURL = 'http://localhost:3000'

/** Playwright's `env` takes strings only, so drop the unset variables. */
const definedEnv = Object.fromEntries(
  Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
)

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests/e2e',
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: 'chromium' },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: baseURL,
    /**
     * Must stay false: reusing a server you already had open would silently put
     * the tests back on the development database. Next 16 also allows only one
     * `next dev` per directory, so stop `pnpm dev` before running e2e (or switch
     * this command to `pnpm build && pnpm start`).
     */
    reuseExistingServer: false,
    env: { ...definedEnv, DATABASE_URL: databaseUrl },
  },
})
