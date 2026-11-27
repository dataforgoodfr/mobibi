# Campaigners: base + OIDC login — design

Source: [dataforgoodfr/mobibi#3](https://github.com/dataforgoodfr/mobibi/issues/3) (body and comments). The issue is the spec; this document restates it and records the decisions taken on top of it. Where the two disagree, this document wins.

## Intent

mobibi gets a third kind of account, **campaigners**: the people at a nonprofit who run campaigns. They will later manage their organization's campaigns from `/:lang/dashboard/:organization`. This slice lays the base: the accounts, their sessions, and login through OIDC, ending on a page that confirms who is signed in.

At Data For Good the provider is the Keycloak of « Plateforme pour la démocratie » (`../plateforme-pour-la-d-mocratie`): shared realm `democratie`, `mobibi` client created by the portal, access gated by the client role `mobibi › access`. mobibi is open source and self-hostable, so nothing may depend on Keycloak specifically.

## Goals

- `campaigners` and `campaigner-sessions` collections.
- OIDC login (authorization code + PKCE), account created on first login, identity `(iss, sub)`.
- Sessions kept alive by refreshing the provider's tokens, revoked when a refresh fails or the required role is gone.
- Logout ending both the mobibi and provider sessions; OIDC back-channel logout.
- `/:lang/dashboard` (signed-in page) and `/:lang/dashboard/login` (error page).
- Off by default: an installation opts in.

## Non-goals

- Magic-link login for campaigners (separate issue). But see Constraints: the model must accommodate it.
- Memberships, organization linking, roles (separate issue; memberships will live in mobibi).
- Anything under `/:lang/dashboard/:organization`.
- Linking accounts by email. Platform admins logging in through OIDC.
- Moving citizens off Payload's strategy chain. `src/lib/citizenSession.ts` is not modified.
- Reading roles from a claim path other than Keycloak's `resource_access.<client>.roles`. A non-Keycloak installation leaves `OIDC_REQUIRED_ROLE` unset; a configurable claim path can come later.

## Anti-goals

- A misconfiguration silently becoming "nobody can log in" — the app refuses to start instead.
- A campaigner session hiding or altering the citizen session on the public site or the admin session in `/admin` in the same browser.
- A valid session ended because two parallel requests raced on a refresh.
- The provider's error text shown to users. Open redirects via `returnTo`.
- Identifying a campaigner by email in OIDC mode.

## Constraints

- **One method per installation**: `CAMPAIGNER_AUTH_METHOD` is `oidc`, `magic-link` (not implemented: refuse to start) or unset (disabled). Never both. The data model and `getCampaigner()` must not assume OIDC, so the magic-link issue only adds a login path:
  - `oidcIssuer` / `oidcSubject` optional on `campaigners`; `email` unique.
  - every OIDC field of `campaigner-sessions` nullable; a magic-link session will have only `campaigner` + `expiresAt`.
  - refresh only applies to sessions that have a `refreshToken`.
  - what a signed-out visitor on `/:lang/dashboard` gets (provider redirect vs. email form) is decided through the config module, not hard-coded in the page.
- **Both collections registered whatever the config**, so schema, generated types and migrations never depend on env vars. Production runs migrations (`prodMigrations` in `payload.config.ts`): the slice ships a migration created with `payload migrate:create`.
- **Every collection declares `create`/`update`/`delete`** (`tests/int/accessControl.int.spec.ts`).
- **No Payload `AuthStrategy`** for campaigners: Payload resolves one `req.user` per request, so a campaigner strategy would shadow the citizen or admin session. Campaigners are resolved by `getCampaigner(payload, headers)` only.
- Endpoints mounted on the `campaigners` collection, avoiding `/login`, `/logout`, `/verify/:id`.

## Approaches

Considered for the "one refresh per session at a time" requirement (parallel requests on an expired access token must not each refresh, or a provider that rotates refresh tokens would fail the second refresh and wrongly end the session):

1. **In-memory mutex keyed by session id.** Simplest, but only holds within one Node process: wrong as soon as mobibi runs more than one instance.
2. **Dedicated lock column** (`refreshLockedUntil`), claimed with an atomic `UPDATE … WHERE lock IS NULL OR lock < now()`. Works across instances; adds a column outside the issue's model.
3. **`accessTokenExpiresAt` as the lock** — _chosen_. The winner claims the refresh by pushing the expiry forward in one atomic statement; losers then see a not-yet-expired token and carry on. Works across instances, adds nothing to the model, same pattern as `consumeMagicLink()`'s `UPDATE … WHERE used_at IS NULL`.

The rest of the flow has one sensible shape given the issue (`openid-client`, endpoints on the collection, DB-backed sessions); no alternative was weighed.

## Design

### Configuration — `src/lib/campaignerAuthConfig.ts`

The only module that reads `CAMPAIGNER_AUTH_METHOD` and `OIDC_*`. Called from `payload.config.ts` so the server, scripts and test suites all validate it.

- Unset → `{ method: null }` (disabled).
- Unknown value, `magic-link`, or `oidc` with `OIDC_ISSUER` / `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` missing → throw with a message naming the variable and the problem.
- Presence checks only, **no network call at startup**: OIDC discovery happens on first use and is cached in the module, so an unreachable provider never prevents mobibi from booting.
- Exposes the derived URLs from `PAYLOAD_PUBLIC_SERVER_URL`: redirect `/api/campaigners/oidc/callback`, post-logout `/`, back-channel `/api/campaigners/oidc/backchannel-logout`.
- `.env.example` gets the four variables, commented as in the issue.

### Data model

**`campaigners`** — plain collection (not `auth`). Access: admin-only for every operation.

- `email` text, required, unique — from the `email` claim, refreshed at each login.
- `name` text — from the `name` claim, refreshed at each login.
- `oidcIssuer`, `oidcSubject` text, optional; unique as a pair when set, enforced in a `beforeValidate`/`beforeChange` hook (no DB constraint expresses "unique when both set" through Payload). Admins may edit `oidcSubject` to repair an account whose provider user was recreated.
- `lastLoginAt` date.

**`campaigner-sessions`** — access `nobody` for every operation; server code only, through the Local API.

- `campaigner` relationship, required, indexed.
- `expiresAt` date, required — hard end. OIDC: the refresh token's expiry when the provider gives one (`refresh_expires_in` on Keycloak), otherwise a fallback of 12 hours _(builder's call on the constant)_. Magic link will use its own TTL.
- `oidcSid` text, indexed, nullable.
- `idToken` text, nullable — plaintext, it grants no access.
- `refreshToken` text, nullable — **encrypted at rest**, AES-256-GCM, key derived from `PAYLOAD_SECRET` (HKDF or SHA-256 with a fixed context string). No new env var. Never returned to any client; the collection is `nobody` anyway.
- `accessTokenExpiresAt` date, nullable — also the refresh lock (below).

### Session — `src/lib/campaignerSession.ts`

- Cookie `campaigner-token`: httpOnly, `SameSite=Lax`, `secure` in production, path `/`; value is the session id signed with `PAYLOAD_SECRET` (same `jose` approach as the citizen cookie). Valid while the row exists and `expiresAt` is in the future. Revoking = deleting the row.
- **`getCampaigner(payload, headers)`** returns the campaigner or `null`:
  1. verify the cookie, load the row; missing or past `expiresAt` → `null` (delete the row if expired).
  2. no `refreshToken`, or `accessTokenExpiresAt` in the future → return the campaigner.
  3. otherwise claim the refresh atomically (raw SQL through the Drizzle handle, like `src/lib/counters.ts`):
     ```sql
     UPDATE campaigner_sessions
     SET access_token_expires_at = now() + interval '30 seconds'
     WHERE id = $1 AND access_token_expires_at < now()
     RETURNING refresh_token
     ```
     - no row returned → another request is refreshing: return the campaigner. Safe because mobibi never uses the access token to call an API, only to check the role.
     - row returned → refresh with the provider. On success, if `OIDC_REQUIRED_ROLE` is set and absent from the new access token's `resource_access.<OIDC_CLIENT_ID>.roles` → delete the row, return `null`. Otherwise write the new tokens (re-encrypted refresh token, `idToken` if returned, real `accessTokenExpiresAt`, `expiresAt` from the new refresh expiry) and return the campaigner. On failure → delete the row, return `null`. A crash mid-refresh leaves the 30-second claim to lapse, and a later request retries.
  - A network error reaching the provider is treated as a failed refresh _(builder's call; the conservative choice — revocation must not be bypassable by the provider being unreachable)_.
- Server components cannot set cookies; that is fine here: a refresh only rewrites the row, never the cookie. A deleted row leaves a dead cookie that resolves to `null` and is cleared on the next endpoint response or logout.
- Local API calls on behalf of a campaigner pass `user: { ...campaigner, collection: 'campaigners' }, overrideAccess: false` (typed explicitly, since `campaigners` is not an auth collection). The existing helpers in `src/access/index.ts` check `user.collection`, so a campaigner matches neither admin nor citizen rules. Nothing in this slice needs such a call yet beyond the tests proving it.

### Endpoints (on `campaigners`; each returns 404 when the method is not `oidc`)

1. **`GET /api/campaigners/oidc/authorize?returnTo=…`** — `returnTo` must be a relative path (starts with a single `/`, not `//` or `/\`), otherwise default to `/fr/dashboard`. Generate `state`, `nonce`, PKCE verifier; store them with `returnTo` in a short-lived httpOnly cookie (`campaigner-oidc`, signed, ~10 min) _(builder's call; avoids a DB table for in-flight logins)_. Redirect to the provider with scopes `openid email profile`.
2. **`GET /api/campaigners/oidc/callback`** — finish with `openid-client` (state, nonce, issuer, audience, PKCE checked). Then refuse if `email` missing, `email_verified !== true`, or required role missing. Look up by `(iss, sub)`:
   - found → update `email`, `name`, `lastLoginAt`; if the new email belongs to another campaigner, refuse and change nothing.
   - not found, email unused → create.
   - not found, email used → refuse and log (no linking).

   Create the session row, set `campaigner-token`, clear `campaigner-oidc`, redirect to `returnTo`. Any error → log the detail server-side, redirect to `/fr/dashboard/login?error=<code>`. Codes are a closed list (e.g. `provider`, `email-unverified`, `access-denied`, `email-conflict`, `state`) mapped to French messages in one module.

3. **`POST /api/campaigners/session/logout`** — delete the row, clear the cookie, redirect (303) to the provider's `end_session_endpoint` with `id_token_hint` and `post_logout_redirect_uri`. No session or no `idToken` → redirect to `/`.
4. **`POST /api/campaigners/oidc/backchannel-logout`** — validate the logout token per OIDC Back-Channel Logout 1.0 (signature via JWKS, `iss`, `aud`, `iat`, `events` contains `http://schemas.openid.net/event/backchannel-logout`, no `nonce`, `sid` or `sub` present). Delete sessions by `oidcSid`, otherwise all sessions of the campaigner with that `sub` (and issuer). 200 on success, 400 on an invalid token.

### Pages

- **`/:lang/dashboard`** — not signed in → redirect to `/api/campaigners/oidc/authorize?returnTo=/:lang/dashboard`. Signed in → « Connecté·e en tant que {name} ({email}) », « Votre compte n'est rattaché à aucune organisation pour le moment. », a logout button (form POST). Nothing else.
- **`/:lang/dashboard/login`** — message for `?error=`, « Réessayer » button → `/api/campaigners/oidc/authorize`. Never redirects on its own.
- Both 404 when the method is not `oidc`, and `dashboard` page routes take precedence over `[organization]` (static segment).
- **Copy**: the issue asks for the site's fr/en mechanism, but none exists — public copy is hard-coded French and `PUBLIC_LOCALES` is `['fr']`. The pages follow the existing practice (French, `/en/dashboard` 404s like every other `/en` page). Copy lives in one module so a future i18n pass finds it.
- **Reserved slug**: `organizations.slug` rejects `dashboard` (a `RESERVED_ORGANIZATION_SLUGS` list validated on the field), whatever the config.

### Tests

Run with `CAMPAIGNER_AUTH_METHOD=oidc` against `oauth2-mock-server` (started by `vitest.setup.ts` / `playwright.config.ts`), never a real Keycloak.

- **Int** (`tests/int/campaignerAuth.int.spec.ts` and friends): every refusal of the issue — tampered `state`, wrong `nonce`, wrong issuer or audience, `email_verified: false`, required role missing at login, new `sub` with a used email, existing campaigner changing to a used email, `returnTo` to another host, invalid back-channel token, refresh failing → session deleted, role gone after refresh → session deleted, parallel `getCampaigner()` on an expired token → exactly one refresh call. Plus first login creates / later logins reuse, back-channel by `sid` and by `sub`, `oidcIssuer`+`oidcSubject` uniqueness, `dashboard` slug rejected, refresh token stored encrypted.
- **Config**: `campaignerAuthConfig` tested directly with env variations — unset, unknown, `magic-link`, each missing `OIDC_*` var. The disabled-mode 404s are tested by calling the endpoint handlers / page guard with a disabled config, rather than booting a second app.
- **Access**: extend `accessControl.int.spec.ts` with both collections; a campaigner `user` cannot read citizens, admins, signatures, submissions, magic links.
- **E2E**: full login → `/fr/dashboard` shows name and email → logout lands on `/`; a citizen session and an admin session in the same browser survive a campaigner login and logout.

### Portal side

One line in `../plateforme-pour-la-d-mocratie/keycloak/realm-democratie.json`: the `mobibi` client's `baseUrl` becomes `/fr/dashboard` (the dashboard redirects to the provider itself). Separate commit in that repo.

### CLAUDE.md additions (proposed)

- Routes: the four `/api/campaigners/…` endpoints and the two dashboard pages.
- Data model: `campaigners`, `campaigner-sessions`.
- Auth: campaigners resolved by `getCampaigner()`, not an `AuthStrategy`, and why; `accessTokenExpiresAt` doubles as the refresh lock; refresh token encrypted with a key derived from `PAYLOAD_SECRET`; config validated at startup without network.

## Calls settled after review

- **Roles are read from the access token**, at login as on refresh: Keycloak puts client roles there, not in the ID token.
- **A null `accessTokenExpiresAt` with a `refreshToken` counts as expired**: the claim's `WHERE` reads `access_token_expires_at IS NULL OR access_token_expires_at < now()`, so a provider that omits `expires_in` still gets refreshed and revoked.
- **The provider call has a timeout shorter than the claim window** (e.g. 10 s against 30 s), so a second request can never refresh with the same token while the first is still waiting.
- **`PAYLOAD_PUBLIC_SERVER_URL` is required when the method is `oidc`**, validated with the `OIDC_*` vars: the redirect URIs are derived from it.
- **Check for migration drift first**: if the current schema already differs from `src/migrations/20260911_125424`, create a catch-up migration in its own commit before this slice's one, so unrelated changes don't land in it.

## Left to the builder

- Exact module split inside `src/lib/` and `src/endpoints/`, error-code names, the 30-second claim window, the 12-hour fallback TTL, key-derivation details.
- How the mock server is wired into each suite.
- Whether the in-flight login state goes in a signed cookie (proposed) or elsewhere, as long as state/nonce/PKCE are bound to the browser that started the flow.
