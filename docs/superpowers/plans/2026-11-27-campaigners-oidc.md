# Campaigners OIDC login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `campaigners` accounts that sign in through OIDC (Keycloak at Data For Good), with DB-backed sessions kept alive by token refresh, logout, back-channel logout, and a `/:lang/dashboard` page confirming who is signed in.

**Architecture:** One config module validates env at startup. Sessions live in `campaigner-sessions`, resolved by `getCampaigner(payload, headers)` (not a Payload `AuthStrategy`); `accessTokenExpiresAt` doubles as the refresh lock. Endpoints mounted on `campaigners` are thin wrappers over `src/lib/campaigner*` functions, which the int tests drive directly against `oauth2-mock-server`.

**Tech Stack:** Next.js 16, Payload 3.85 (Postgres), `openid-client` v6, `jose` (already a dependency), `oauth2-mock-server` (dev), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-27-campaigners-oidc-design.md` (itself built on dataforgoodfr/mobibi#3). Read it before starting.

## Global Constraints

- Branch `feat/campaigners-oidc`. Before writing code, invoke the `green-claude` skill (user rule for new features). Use the `payload` skill for anything touching a collection.
- Commits: Conventional Commits, **no `Co-Authored-By` or AI attribution line**, and **propose each message to the user and wait for their "ok" before `git commit`**. Run `pnpm format` before each commit.
- Minimal comments: only the non-obvious why.
- Env vars, exactly: `CAMPAIGNER_AUTH_METHOD` (`oidc` | `magic-link` | unset), `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_REQUIRED_ROLE` (optional). `PAYLOAD_PUBLIC_SERVER_URL` required when the method is `oidc`.
- Derived URLs: redirect `${PAYLOAD_PUBLIC_SERVER_URL}/api/campaigners/oidc/callback`, post-logout `${PAYLOAD_PUBLIC_SERVER_URL}/`, back-channel `${PAYLOAD_PUBLIC_SERVER_URL}/api/campaigners/oidc/backchannel-logout`.
- Roles are read from the **access token** at `resource_access.<OIDC_CLIENT_ID>.roles`.
- Cookies: `campaigner-token` (session) and `campaigner-oidc` (in-flight login, 10 min), both httpOnly, `SameSite=Lax`, path `/`, `secure` in production, values are HS256 JWTs signed with `payload.secret` via `jose`.
- Refresh claim window 30 s; provider call timeout 10 s; fallback session lifetime 12 h when the provider gives no `refresh_expires_in`.
- Scopes `openid email profile`. Never show provider error text to users; log it server-side.
- `src/lib/citizenSession.ts` is not modified. Campaigners are never put in `req.user`.
- Every `/api/campaigners/…` endpoint and both dashboard pages return 404 unless the method is `oidc`.
- Emails are stored and compared lowercase.

## Review Focus

- `returnTo` values `//evil.com`, `/\evil.com`, `https://evil.com`, `%2F%2Fevil.com`, `javascript:…`, empty → all fall back to `/fr/dashboard`. Test in Task 5.
- The callback replayed (browser back, double click) after the flow cookie was cleared or with a used code → error page with code `state` or `provider`, never a 500. Test in Task 5.
- A Keycloak user with no first/last name (no `name` claim) → account created, page shows the email alone. Tests in Tasks 5 and 8.
- An admin deletes a campaigner who has live sessions → the sessions are deleted with it; the old cookie resolves to `null`. Test in Task 3.
- An email claim differing only in case from an existing campaigner's email → treated as the same email (conflict refusal applies). Test in Task 5.

---

### Task 1: Campaigner auth config

**Files:**
- Create: `src/lib/campaignerAuthConfig.ts`
- Modify: `src/payload.config.ts` (call `getCampaignerAuthConfig()` at module top level), `.env.example`, `vitest.setup.ts`
- Test: `tests/int/campaignerAuthConfig.int.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  export type OidcConfig = {
    issuer: string; clientId: string; clientSecret: string; requiredRole: string | null
    redirectUri: string; postLogoutRedirectUri: string; backchannelLogoutUri: string
  }
  export type CampaignerAuthConfig = { method: null } | { method: 'oidc'; oidc: OidcConfig }
  export class CampaignerAuthConfigError extends Error {}
  export const parseCampaignerAuthConfig: (env: Record<string, string | undefined>) => CampaignerAuthConfig
  export const getCampaignerAuthConfig: () => CampaignerAuthConfig // parses process.env once, cached
  ```

- [ ] **Step 1: Write the failing tests** — `parseCampaignerAuthConfig`:
  - `{}` → `{ method: null }`
  - `{ CAMPAIGNER_AUTH_METHOD: 'saml' }` throws `CampaignerAuthConfigError` matching `/CAMPAIGNER_AUTH_METHOD.*saml/`
  - `'magic-link'` throws matching `/magic-link.*not implemented/i`
  - `'oidc'` with each of `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `PAYLOAD_PUBLIC_SERVER_URL` removed in turn throws a message containing that variable name (`it.each`)
  - complete `oidc` env with `PAYLOAD_PUBLIC_SERVER_URL=https://mobibi.example.org/` (trailing slash) → `redirectUri === 'https://mobibi.example.org/api/campaigners/oidc/callback'`, `postLogoutRedirectUri === 'https://mobibi.example.org/'`, `backchannelLogoutUri === 'https://mobibi.example.org/api/campaigners/oidc/backchannel-logout'`, `requiredRole === null`; with `OIDC_REQUIRED_ROLE=access` → `'access'`; an empty-string `OIDC_REQUIRED_ROLE` → `null`.
- [ ] **Step 2: Run** `pnpm test:int tests/int/campaignerAuthConfig.int.spec.ts` — Expected: FAIL (module not found).
- [ ] **Step 3: Implement** the module. Presence checks only, no network. Empty strings count as missing.
- [ ] **Step 4: Wire it**: `payload.config.ts` calls `getCampaignerAuthConfig()` before `buildConfig` so a bad config throws at boot. `.env.example` gets the block from the issue's Configuration section (comments included). `vitest.setup.ts` sets, when unset: `CAMPAIGNER_AUTH_METHOD=oidc`, `OIDC_ISSUER=http://localhost:4010`, `OIDC_CLIENT_ID=mobibi`, `OIDC_CLIENT_SECRET=test-secret`, `OIDC_REQUIRED_ROLE=access`, `PAYLOAD_PUBLIC_SERVER_URL=http://localhost:3000`.
- [ ] **Step 5: Run** `pnpm test:int` — Expected: all PASS (existing suites still boot).
- [ ] **Step 6: Commit** — `feat(campaigners): validate campaigner auth config at startup`

### Task 2: Secret encryption

**Files:**
- Create: `src/lib/secretBox.ts`
- Test: `tests/int/secretBox.int.spec.ts`

**Interfaces:**
- Produces: `encryptSecret(plain: string, secret: string): string` and `decryptSecret(sealed: string, secret: string): string` (throws on tampering or wrong secret).

- [ ] **Step 1: Write the failing tests**: round-trip returns the input; two encryptions of the same input differ; output does not contain the input; flipping one character of the ciphertext part throws; decrypting with another secret throws.
- [ ] **Step 2: Run** `pnpm test:int tests/int/secretBox.int.spec.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** with `node:crypto`: key = `hkdfSync('sha256', secret, '', 'mobibi:campaigner-refresh-token', 32)`, AES-256-GCM, 12-byte random IV, output `v1.<iv>.<tag>.<ciphertext>` in base64url.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(campaigners): add secret encryption helper`

### Task 3: Collections, reserved slug, migration

**Files:**
- Create: `src/collections/Campaigners.ts`, `src/collections/CampaignerSessions.ts`, migration under `src/migrations/`
- Modify: `src/payload.config.ts` (register both), `src/fields/validation.ts` (add `reservedOrganizationSlug`), `src/collections/Organizations.ts:26`, `src/payload-types.ts` (generated), `tests/int/accessControl.int.spec.ts`
- Test: `tests/int/campaigners.int.spec.ts`

**Interfaces:**
- Produces: collections `campaigners` (`email` unique, `name`, `oidcIssuer`, `oidcSubject`, `lastLoginAt`) and `campaigner-sessions` (`campaigner` required + indexed, `expiresAt` required, `oidcSid` indexed, `idToken`, `refreshToken`, `accessTokenExpiresAt`, all OIDC fields optional); types `Campaigner`, `CampaignerSession` in `payload-types.ts`; `RESERVED_ORGANIZATION_SLUGS = ['dashboard']` and `reservedOrganizationSlug(value: unknown): string | true` in `src/fields/validation.ts`.

- [ ] **Step 1: Check migration drift first**: `pnpm payload migrate:create catchup --skip-empty`. If a file is created, it means the schema already differs from the last migration: stop, show it to the user, commit it alone (`build(db): add catch-up migration`) once they agree. If none, continue.
- [ ] **Step 2: Write the failing tests** in `campaigners.int.spec.ts` (fixtures suffixed with `Date.now()`, cleaned up in `afterAll`):
  - creating two campaigners with the same `oidcIssuer` + `oidcSubject` → second rejects with a validation error; same subject, different issuer → allowed; two campaigners without OIDC identity → allowed.
  - email is stored lowercase: create with `Alice-<run>@Example.org` → `email === 'alice-<run>@example.org'`; then creating `alice-<run>@example.org` rejects (unique).
  - deleting a campaigner deletes its `campaigner-sessions` rows (Review Focus).
  - an organization with slug `dashboard` rejects; `Dashboard` (slugified to `dashboard`) rejects too.
  - `accessControl.int.spec.ts`: a citizen user cannot `find` `campaigners` nor `campaigner-sessions`; an admin can `find` `campaigners` but not `campaigner-sessions` (`overrideAccess: false`); a campaigner passed as `user: { ...campaigner, collection: 'campaigners' }` with `overrideAccess: false` gets `not allowed` on `find` for `citizens`, `admins`, `petition-signatures`, `interpellation-submissions`, `magic-links`, `campaigners`, `campaigner-sessions`. The existing "no collection grants a citizen unrestricted writes" test must still pass with the new collections.
- [ ] **Step 3: Run** `pnpm test:int tests/int/campaigners.int.spec.ts tests/int/accessControl.int.spec.ts` — Expected: FAIL.
- [ ] **Step 4: Implement the collections**: `campaigners` access `isAdmin` on read/create/update/delete, `admin` group `Campaigners`, `useAsTitle: 'email'`; a `beforeValidate` hook lowercases `email` and rejects a duplicate `(oidcIssuer, oidcSubject)` pair (excluding the document's own id) with Payload's `ValidationError`; a `beforeDelete` hook deletes the campaigner's sessions. `campaigner-sessions`: `nobody` on all four operations, `admin.hidden: true`. Endpoints come in Task 7 — leave `endpoints` out for now.
- [ ] **Step 5: Implement the reserved slug**: `{ ...slugField('name'), unique: true, validate: reservedOrganizationSlug }` on `organizations`; message `'This slug is reserved.'`.
- [ ] **Step 6: Generate**: `pnpm generate:types`, then `pnpm payload migrate:create campaigners`. Check the migration only creates the two tables, their indexes and the `payload_locked_documents_rels` columns Payload adds.
- [ ] **Step 7: Run** `pnpm test:int` — Expected: all PASS.
- [ ] **Step 8: Commit** — `feat(campaigners): add campaigners and campaigner-sessions collections`

### Task 4: OIDC mock and client

**Files:**
- Modify: `package.json` (`openid-client@^6`, dev `oauth2-mock-server`)
- Create: `src/lib/campaignerOidc.ts`, `tests/helpers/oidcMock.ts`
- Test: covered from Task 5 (this task has no behaviour of its own beyond what Task 5 exercises) — its deliverable is checked by Step 4.

**Interfaces:**
- Consumes: `getCampaignerAuthConfig()`, `OidcConfig`.
- Produces (`src/lib/campaignerOidc.ts`):
  ```ts
  export const getOidcClient: () => Promise<client.Configuration> // discovery once, cached promise, reset on failure
  export const hasClientRole: (accessToken: string, clientId: string, role: string) => boolean
  ```
- Produces (`tests/helpers/oidcMock.ts`):
  ```ts
  export type MockUser = { sub: string; email?: string; email_verified?: boolean; name?: string; roles?: string[] }
  export const startOidcMock: (port: number) => Promise<OidcMock>
  type OidcMock = {
    issuer: string
    setUser(user: MockUser): void
    tamperIdToken(patch: Record<string, unknown>): void // one-shot: merged into the next id token's claims
    failNextRefresh(): void
    refreshCount(): number
    authorizeCode(authorizationUrl: string): Promise<URL> // follows the mock's /authorize redirect, returns the callback URL with code + state
    buildLogoutToken(claims: Record<string, unknown>): Promise<string>
    stop(): Promise<void>
  }
  ```

- [ ] **Step 1: Install**: `pnpm add openid-client@^6` and `pnpm add -D oauth2-mock-server`.
- [ ] **Step 2: Implement `getOidcClient`**: `client.discovery(new URL(issuer), clientId, clientSecret, undefined, opts)` with `execute: [client.allowInsecureRequests]` only when the issuer URL is `http:`; set `config[client.customFetch]` to a fetch adding `AbortSignal.timeout(10_000)`. `hasClientRole` decodes with `jose.decodeJwt` (the token comes straight from the token endpoint), returns `false` for a non-JWT token.
- [ ] **Step 3: Implement the mock helper** over `OAuth2Server`: generate an RS256 key, `start(port, 'localhost')`; `beforeTokenSigning` writes the current user's claims (and `resource_access: { mobibi: { roles } }` on the access token) plus any one-shot tamper; `beforeResponse` on `grant_type=refresh_token` counts calls and, when armed, sets status 400 with `{ error: 'invalid_grant' }`. Check that the mock echoes `nonce` into the id token; if it does not, add it in `beforeTokenSigning` from the stored authorize request.
- [ ] **Step 4: Verify**: `pnpm exec tsc --noEmit` — Expected: no errors.
- [ ] **Step 5: Commit** — `build(campaigners): add openid-client and an OIDC mock for tests`

### Task 5: Login (authorize + callback) and session creation

**Files:**
- Create: `src/lib/campaignerSession.ts` (creation part), `src/lib/campaignerLogin.ts`
- Modify: `src/lib/db.ts` (add `getPoolDb`)
- Test: `tests/int/campaignerOidc.int.spec.ts` (mock started on port 4010 in `beforeAll` — all OIDC int tests live in this one file because the issuer is process-wide)

**Interfaces:**
- Consumes: `getOidcClient`, `hasClientRole`, `encryptSecret`, `getCampaignerAuthConfig`, `startOidcMock`.
- Produces:
  ```ts
  // campaignerSession.ts
  export type OidcSessionTokens = { sid: string | null; idToken: string; refreshToken: string | null; accessTokenExpiresAt: Date; refreshExpiresAt: Date | null }
  export const createCampaignerSession: (payload: Payload, campaignerId: number, oidc: OidcSessionTokens | null) => Promise<string> // Set-Cookie
  export const clearCampaignerSessionCookie: () => string
  // campaignerLogin.ts
  export type LoginErrorCode = 'provider' | 'state' | 'email-missing' | 'email-unverified' | 'access-denied' | 'email-conflict'
  export const safeReturnTo: (value: string | null | undefined) => string // default '/fr/dashboard'
  export const startLogin: (returnTo: string | null) => Promise<{ redirectUrl: string; setCookie: string }>
  export const completeLogin: (payload: Payload, search: string, flowCookie: string | undefined) => Promise<
    | { ok: true; returnTo: string; setCookies: string[] }
    | { ok: false; error: LoginErrorCode; lang: Locale; setCookies: string[] }
  >
  // db.ts
  export const getPoolDb: (payload: Payload) => DrizzleLike
  ```

- [ ] **Step 1: Write the failing tests** (helper: `login(user)` = `startLogin` → `mock.authorizeCode` → `completeLogin` with the flow cookie value):
  - `safeReturnTo`: `/fr/dashboard` kept, `/fr/dashboard?x=1` kept; `//evil.com`, `/\evil.com`, `https://evil.com`, `%2F%2Fevil.com`, `javascript:alert(1)`, `''`, `null` → `'/fr/dashboard'` (`it.each`, Review Focus).
  - first login with `{ sub, email, email_verified: true, name: 'Alice', roles: ['access'] }` → `ok`, a `campaigners` row with `oidcIssuer === mock.issuer`, `oidcSubject === sub`, `lastLoginAt` set; a `campaigner-sessions` row whose `refreshToken` is not the raw token and decrypts to it; `setCookies` contains `campaigner-token=` and clears `campaigner-oidc`.
  - second login same `sub`, new email and name → same campaigner id, email and name updated.
  - no `name` claim → campaigner created, `name` empty (Review Focus).
  - refusals, each asserting the error code and that no campaigner/session was written: `state` tampered (`completeLogin` with a search whose `state` differs) → `state`; missing flow cookie → `state`; same callback replayed twice → second is `state` or `provider`, never throws (Review Focus); `tamperIdToken({ nonce: 'x' })` → `provider`; `tamperIdToken({ iss: 'http://other' })` → `provider`; `tamperIdToken({ aud: 'other' })` → `provider`; no `email` → `email-missing`; `email_verified: false` → `email-unverified`; `roles: []` → `access-denied`; new `sub` with an email already used → `email-conflict`; same with the email in another case (`ALICE-…`) → `email-conflict` (Review Focus); existing campaigner whose new email belongs to another → `email-conflict` and their row unchanged; `?error=access_denied` in the search → `access-denied`.
- [ ] **Step 2: Run** `pnpm test:int tests/int/campaignerOidc.int.spec.ts` — Expected: FAIL.
- [ ] **Step 3: Implement `createCampaignerSession`**: `expiresAt` = `refreshExpiresAt` ?? now + 12 h (magic link will pass `null` and its own TTL later — do not add that now); refresh token stored via `encryptSecret(…, payload.secret)`; cookie = JWT `{ sid: <row id> }` expiring at `expiresAt`, `maxAge` to match.
- [ ] **Step 4: Implement `startLogin`**: random state, nonce, PKCE verifier; flow cookie `campaigner-oidc` = signed JWT `{ state, nonce, codeVerifier, returnTo: safeReturnTo(returnTo) }`, 10 min; `buildAuthorizationUrl` with `redirect_uri`, `scope: 'openid email profile'`, `code_challenge_method: 'S256'`.
- [ ] **Step 5: Implement `completeLogin`**: verify the flow cookie (`state` error if missing/invalid); a provider `error` param → `access-denied` for `access_denied`, `provider` otherwise; call `authorizationCodeGrant` with `new URL(oidc.redirectUri + search)` (never the incoming request URL: openid-client derives `redirect_uri` from it, and behind a proxy the host differs) and the expected state/nonce/verifier; map `client.AuthorizationResponseError` on state → `state`, any other error → `provider`, logging `error.message` server-side. Then check email / `email_verified === true` / `hasClientRole` on the access token, upsert the campaigner per the spec's three cases (email lowercased, lookup by `oidcIssuer` + `oidcSubject`), create the session with `sid` from the id token, `refresh_expires_in` from the token response when present. `lang` for errors = first segment of `returnTo` when `isLocale`, else `'fr'`. Always clear the flow cookie.
- [ ] **Step 6: Run** — Expected: PASS.
- [ ] **Step 7: Commit** — `feat(campaigners): add OIDC login and campaigner session creation`

### Task 6: `getCampaigner` and the refresh lock

**Files:**
- Modify: `src/lib/campaignerSession.ts`
- Test: `tests/int/campaignerOidc.int.spec.ts` (new `describe('getCampaigner')`)

**Interfaces:**
- Consumes: Task 5's session rows and cookie, `getPoolDb`, `getOidcClient`, `hasClientRole`, `decryptSecret`, `encryptSecret`.
- Produces:
  ```ts
  export const readCampaignerSession: (payload: Payload, headers: Headers) => Promise<CampaignerSession | null> // cookie + row, no refresh
  export const getCampaigner: (payload: Payload, headers: Headers) => Promise<Campaigner | null>
  ```

- [ ] **Step 1: Write the failing tests** (sign in with the Task 5 helper, build `Headers` from the session cookie; force expiry by setting `accessTokenExpiresAt` in the past through the Local API):
  - valid unexpired session → returns the campaigner, `mock.refreshCount()` unchanged.
  - no cookie, forged cookie, cookie for a deleted row → `null`.
  - row past `expiresAt` → `null` and the row is deleted.
  - expired access token → refreshed once; returns the campaigner; `accessTokenExpiresAt` is in the future and `refreshToken` updated.
  - `accessTokenExpiresAt` null with a refresh token → refreshed.
  - `failNextRefresh()` → `null`, row deleted.
  - user's roles set to `[]` before the refresh → `null`, row deleted.
  - 5 parallel `getCampaigner` calls on an expired token → `refreshCount()` increased by exactly 1 and all 5 return the campaigner.
  - session with no refresh token (created with `oidc: null`) → returned as long as `expiresAt` is in the future, never refreshed.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement** per the spec's Session section. The claim statement, through `getPoolDb(payload)`:
  ```sql
  UPDATE campaigner_sessions
  SET access_token_expires_at = now() + interval '30 seconds'
  WHERE id = $1 AND refresh_token IS NOT NULL
    AND (access_token_expires_at IS NULL OR access_token_expires_at < now())
  RETURNING refresh_token
  ```
  No row → return the campaigner. Row → `refreshTokenGrant`; on success write the new tokens (keep the old refresh token if none returned, `idToken` if returned); on any error or missing role → delete the row, return `null`.
- [ ] **Step 4: Run** `pnpm test:int` — Expected: all PASS.
- [ ] **Step 5: Commit** — `feat(campaigners): resolve campaigner sessions with a single refresh at a time`

### Task 7: Logout, back-channel logout, endpoints

**Files:**
- Create: `src/lib/campaignerBackchannel.ts`, `src/endpoints/campaigners.ts`
- Modify: `src/lib/campaignerSession.ts` (logout helper), `src/collections/Campaigners.ts` (`endpoints: campaignerEndpoints()`)
- Test: `tests/int/campaignerOidc.int.spec.ts`, `tests/int/campaignerEndpoints.int.spec.ts`

**Interfaces:**
- Consumes: everything above.
- Produces:
  ```ts
  export const logoutCampaigner: (payload: Payload, headers: Headers) => Promise<{ redirectUrl: string; setCookie: string }>
  export const backchannelLogout: (payload: Payload, logoutToken: string) => Promise<boolean> // false = invalid token
  export const campaignerEndpoints: (getConfig?: () => CampaignerAuthConfig) => Endpoint[]
  ```
  Endpoints: `GET /oidc/authorize`, `GET /oidc/callback`, `POST /session/logout`, `POST /oidc/backchannel-logout`.

- [ ] **Step 1: Write the failing tests**:
  - `logoutCampaigner` with a session → row deleted, cookie cleared, `redirectUrl` is the mock's end-session URL with `id_token_hint` and `post_logout_redirect_uri=http://localhost:3000/`; without a session → `redirectUrl === 'http://localhost:3000/'`.
  - `backchannelLogout` with a token from `mock.buildLogoutToken({ sid, sub, aud: 'mobibi', events: { 'http://schemas.openid.net/event/backchannel-logout': {} } })` → `true`, that session deleted, another session of the same campaigner kept; with `sub` only → all that campaigner's sessions deleted; unknown `sid` → `true`, nothing deleted. Invalid → `false` and nothing deleted: wrong `aud`, missing `events`, a `nonce` present, neither `sid` nor `sub`, signed by another key, wrong `iss`.
  - `campaignerEndpoints(() => ({ method: null }))`: each of the four handlers returns 404.
  - callback handler on error → 302 to `/fr/dashboard/login?error=<code>`; on success → 302 to `returnTo` with both `Set-Cookie` headers; back-channel handler → 200 / 400; logout handler → 303.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement** `backchannelLogout` with `jose.jwtVerify` against `createRemoteJWKSet(new URL(serverMetadata().jwks_uri))`, `issuer`, `audience: clientId`, `maxTokenAge: '2 minutes'`, then the claim checks; delete by `oidcSid`, else by the campaigner matching `oidcIssuer` + `oidcSubject`. The endpoint reads `logout_token` from the form-urlencoded body.
- [ ] **Step 4: Implement** `logoutCampaigner` (`buildEndSessionUrl`) and `campaignerEndpoints`, each handler starting with the 404 check from `getConfig()`.
- [ ] **Step 5: Run** `pnpm test:int` — Expected: all PASS.
- [ ] **Step 6: Commit** — `feat(campaigners): add logout, back-channel logout and campaigner endpoints`

### Task 8: Dashboard pages, e2e, portal seed

**Files:**
- Create: `src/app/(frontend)/[lang]/dashboard/page.tsx`, `src/app/(frontend)/[lang]/dashboard/login/page.tsx`, `src/components/dashboard/copy.ts`, `tests/helpers/oidcMockServer.ts`, `tests/e2e/campaigner.e2e.spec.ts`
- Modify: `playwright.config.ts` (`webServer` becomes an array: the mock first on port 4011, then `pnpm dev` with `CAMPAIGNER_AUTH_METHOD=oidc`, `OIDC_ISSUER=http://localhost:4011`, `OIDC_CLIENT_ID=mobibi`, `OIDC_CLIENT_SECRET=test-secret`, `OIDC_REQUIRED_ROLE=access`), `../plateforme-pour-la-d-mocratie/keycloak/realm-democratie.json`

**Interfaces:**
- Consumes: `getCampaigner`, `getCampaignerAuthConfig`, `LoginErrorCode`, `startOidcMock`.
- Produces: `LOGIN_ERROR_MESSAGES: Record<LoginErrorCode, string>` and `DEFAULT_LOGIN_ERROR` in `copy.ts`.

- [ ] **Step 1: Write the failing e2e** (`campaigner.e2e.spec.ts`; the mock server's default user is `e2e-campaigner@example.com`, name `Camille Martin`, verified, role `access`):
  - `/fr/dashboard` signed out → lands back on `/fr/dashboard` showing `Connecté·e en tant que Camille Martin (e2e-campaigner@example.com)` and `Votre compte n'est rattaché à aucune organisation pour le moment.`; clicking `Se déconnecter` lands on `/`; visiting `/fr/dashboard` again starts a new login (no cookie left).
  - `/fr/dashboard/login?error=access-denied` shows `Votre compte n'a pas accès à mobibi.` and a `Réessayer` link to `/api/campaigners/oidc/authorize`; the page does not navigate by itself.
  - a citizen signed in through the magic link (pattern of `auth.e2e.spec.ts`) and an admin signed in (`tests/helpers/login.ts`, seeded like `admin.e2e.spec.ts`) in the same context, then campaigner login and logout → the public nav still shows the citizen's pseudo and `/admin` still shows the dashboard.
  - afterAll deletes the campaigner by email.
- [ ] **Step 2: Run** `pnpm test:e2e tests/e2e/campaigner.e2e.spec.ts` (with `pnpm dev` stopped) — Expected: FAIL.
- [ ] **Step 3: Implement the copy**: `provider` « La connexion n'a pas pu aboutir. Réessayez dans un instant. », `state` « La connexion a expiré ou a été interrompue. Réessayez. », `email-missing` « Votre compte ne fournit pas d'adresse e-mail. Contactez la personne qui vous a invité·e. », `email-unverified` « Votre adresse e-mail n'est pas encore vérifiée. Vérifiez-la, puis réessayez. », `access-denied` « Votre compte n'a pas accès à mobibi. », `email-conflict` « Cette adresse e-mail est déjà utilisée par un autre compte. Contactez l'équipe mobibi. », default « Une erreur est survenue pendant la connexion. »
- [ ] **Step 4: Implement the pages** (`dynamic = 'force-dynamic'`, `notFound()` unless the method is `oidc` or the lang is not a locale). Dashboard: `getCampaigner(payload, await headers())`, `null` → `redirect('/api/campaigners/oidc/authorize?returnTo=' + encodeURIComponent('/' + lang + '/dashboard'))`; shows `Connecté·e en tant que {name} ({email})`, or `Connecté·e en tant que {email}` when there is no name; logout is a `<form method="post" action="/api/campaigners/session/logout">` with a `Se déconnecter` button. Login page: message for `?error=` (unknown code → default), `Réessayer` link. Reuse existing brand/UI components for layout; no new shadcn component.
- [ ] **Step 5: Implement `tests/helpers/oidcMockServer.ts`**: a standalone script that calls `startOidcMock(4011)` with the default e2e user and stays up.
- [ ] **Step 6: Run** `pnpm test:e2e` — Expected: all PASS.
- [ ] **Step 7: Portal seed**: in `../plateforme-pour-la-d-mocratie/keycloak/realm-democratie.json`, the `mobibi` client's `baseUrl` becomes `/fr/dashboard`. Separate commit in that repo, message `fix(keycloak): point the mobibi tile at its dashboard` — ask the user first.
- [ ] **Step 8: Commit** (mobibi) — `feat(campaigners): add dashboard and login error pages`

### Task 9: Manual acceptance against Keycloak, docs

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Run against the portal's Keycloak**: `pnpm keycloak:up` in `../plateforme-pour-la-d-mocratie`; mobibi `.env` with `CAMPAIGNER_AUTH_METHOD=oidc`, `OIDC_ISSUER=http://localhost:8180/realms/democratie`, `OIDC_CLIENT_ID=mobibi`, `OIDC_CLIENT_SECRET=dev-mobibi-secret`, `OIDC_REQUIRED_ROLE=access`; `pnpm dev`. Check each acceptance criterion of the issue, with the seed users:
  - a user with `mobibi › access` signs in and sees name and email on `/fr/dashboard`; one without is refused;
  - logout ends the Keycloak session with no confirmation screen;
  - ending the session in the Keycloak admin console (Sessions → Sign out) ends the mobibi one (back-channel reaches `host.docker.internal:3000`: `next dev` must listen on all interfaces);
  - disabling the user, or removing `access`, ends the mobibi session within 5 minutes;
  - unsetting `CAMPAIGNER_AUTH_METHOD` → `/fr/dashboard` and `/api/campaigners/oidc/authorize` return 404; `magic-link` or a missing `OIDC_CLIENT_SECRET` → `pnpm dev` fails with the message.
  Report each result to the user; any failure goes back to the owning task.
- [ ] **Step 2: Update `CLAUDE.md`** with the lines proposed in the spec (Routes, Data model, Auth).
- [ ] **Step 3: Verify**: `pnpm lint`, `pnpm test:int`, `pnpm test:e2e`, `pnpm format` — Expected: all clean.
- [ ] **Step 4: Commit** — `docs: document campaigner accounts and OIDC login`
