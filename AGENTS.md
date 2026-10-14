# mobibi — agent guide

## Product

**mobibi** hosts citizen mobilisations run by nonprofits, in two forms:

- **Interpellation** : citizens contact elected officials (email / Twitter) using a pre-written message, then declare they did it. A per-target counter goes up.
- **Petition** : citizens sign a text. A counter progresses toward tiers (paliers).

## Stack

- **Next.js 16** : App Router, Turbopack. Two route groups — `(frontend)` for the public site, `(payload)` for the admin panel and API.
- **Payload 3.85** : CMS, admin panel, auth, REST + GraphQL. Config in `src/payload.config.ts`.
- **Postgres** : via `@payloadcms/db-postgres`. Schema is pushed automatically in dev.
- **Drizzle** : not used directly except for atomic counter updates in `src/lib/counters.ts`.
- **React 19 + Tailwind CSS 4 + shadcn** : `components.json` (style `base-nova`, lucide icons), components in `src/components/ui/`.
- **pnpm 11 / Node 22**.

## Routes

- `/` : redirects to `/fr` (see i18n).
- `/:lang` : all active mobilisations, across organizations.
- `/:lang/:organization` : organization page and its mobilisations.
- `/:lang/:organization/:slug` : a mobilisation, either type. Self-contained and shareable.
- `/admin` : Payload admin panel.
- `/api/*` : Payload REST API. `/api/graphql` for GraphQL.
- `/api/petitions/:id/recent-signatures` : custom endpoint returning only pseudo + city + date, so `petition-signatures` can stay admin-only and never expose citizen emails.
- `/api/petitions/:id/sign` (POST) : writes the signature straight away for a citizen who already has a session, otherwise issues a magic link carrying the filled-in form as its intent.
- `/api/campaign-targets/:id/interpellate` (POST) : the same two outcomes for « j'ai interpellé ». Mounted on the target, not on the campaign, because the target is the thing acted on and carries its own campaign — so the campaign is never trusted from the request body.
- `/api/citizens/magic-link` (POST) : requests a magic link. `/api/citizens/magic-link/verify` (GET) : redeems one — always redirects, the same URL a real emailed link points at. `/api/citizens/session/logout` (POST) : clears the citizen session. Not `/login`/`/logout`/`/verify/:id` — those paths are reserved, auto-registered by Payload on every auth-enabled collection.

## Data model

Collections in `src/collections/`. Field and collection names are English; content is localized.

- `organizations` : the nonprofits running campaigns. `slug` is the first URL segment.
- `interpellations` : campaign — timeline, context/demand, per-channel default messages.
- `petitions` : campaign — text, tiers, extra signing-form fields.
- `campaign-targets` : a person to contact, scoped to one interpellation; carries the channels.
- `interpellation-submissions` : one declared « j'ai interpellé ».
- `petition-signatures` : one signature.
- `citizens` : public accounts (magic link).
- `magic-links` : pending token + the action to perform when it is clicked.
- `admins` : platform administrators.
- `media` : uploads.

## Decisions

- **Two campaign collections, one URL space** : `/:organization/:slug` resolves to either type, so slug uniqueness spans both collections. No DB constraint can express that — `validateUniqueCampaignSlug` enforces it.
- **Interpellations are repeatable, signatures are not** : multiple submissions for the same (citizen, target, channel) are allowed by design, and the counter counts submissions, not people. Petitions are the opposite — one signature per citizen, enforced in a hook.
- **Counters are denormalised, incremented with raw SQL** (`src/lib/counters.ts`) : never read-modify-write, which loses increments under concurrency.
- **`campaign-targets` is campaign-scoped on purpose** : a shared `targets` collection of reusable people can be added later as a nullable relationship, turning today's inline identity fields into per-campaign overrides. Read targets through `resolveTarget()` so that fallback lands in one place.
- **No optimistic counters** : an unauthenticated citizen acts before having an account, so the pending action is stored in `magic-links.intent` and only written once the link is clicked.
- **Snapshot, don't reference** : submissions and signatures copy the labels the citizen actually saw (non-localized) and the channel type, so later edits to a campaign can't re-point existing answers.
- **Deleting a target with submissions is blocked**, not cascaded : it would destroy the campaign's recorded history.
- **`src/lib/campaigns.ts` is the campaign read path** : the two collections are merged into one `CampaignSummary` there and nowhere else, the same way `resolveTarget()` owns the target read path.
- **shadcn components are added per slice, restyled on arrival** : one is pulled in only when a primitive carries behaviour worth not hand-rolling (keyboard, focus, ARIA), and never ahead of the slice that uses it — it would land on the default tokens and be restyled anyway. Pure visual pieces stay hand-written in `src/components/brand/`.
- **`src/lib/signatures.ts` is the signature read and write path** : both the campaign page (through the Local API) and the `/api/petitions/:id/recent-signatures` endpoint call `listRecentSignatures()`, so pseudo + city + date only, no citizen email, stays defined in one place — and both ways a signature can be written (the direct one and magic-link redemption) go through `createSignature()`, so neither can drift from the other.
- **`src/lib/organizations.ts` is the organization read path** : the one place an `organizations` document is turned into what components consume, the same way `campaigns.ts` / `resolveTarget()` / `signatures.ts` own their read paths.
- **`src/lib/submissions.ts` is the interpellation read and write path** : both ways a submission can be written (the direct one and magic-link redemption) go through `createSubmission()`, so neither can drift — the twin of `createSignature()`. It swallows nothing: a repeat is legal here, so any error from a redemption is a real one, unlike the signature arm's one-per-citizen forgiveness. `getCitizenSubmissions()` is the read side, one query per page rather than one per card.
- **A citizen's own history is shown where it costs no layout** : the « déjà interpellé·e » mark is an `absolute` badge on the avatar and a label swap on a button that already exists, because target cards share a grid row — anything that adds a line makes every card in the row taller. Same reason the personal total lives inside the header's already-floating stat card.
- **Every channel type must be actionable end to end** : `CHANNEL_TYPES` (`src/fields/channels.ts`) and the `deepLink()` switch in `interpeller-modal.tsx` are one decision in two files — adding a type without its link would let an admin configure a channel the public flow can only show as inert text. That is why there is no catch-all `other`.

## Auth

- **Citizen sessions use a custom `AuthStrategy` with a distinct `citizen-token` cookie, never Payload's built-in login** (`src/lib/citizenSession.ts`) : `disableLocalStrategy` makes `payload.login()` 403 unconditionally, and Payload's built-in JWT strategy shares one cookie name across every auth collection — reusing it would collide with the admin panel's `payload-token` session on the same origin.
- **`citizens.emailVerified` and `citizens.sessions` keep `access: { update: () => false }` on purpose** : `citizens.access.update` is `isAdminOrSelf`, so without the lock a citizen could self-verify their own email or forge a session id via their own REST `PATCH`. Only server-side redemption (`src/lib/magicLink.ts`) bypasses it, via the Local API's default `overrideAccess: true`.
- **Magic-link redemption is single-use via an atomic `UPDATE … WHERE used_at IS NULL`**, not check-then-write : a race would mint two sessions from one link, or — once a slice writes a submission/signature inside redemption — double-count an action. Keep any future write inside `consumeMagicLink()` on the far side of that claim.
- **Email goes through SMTP (`@payloadcms/email-nodemailer`) when `SMTP_HOST` is set, console-log otherwise** (`src/lib/email.ts`)

## i18n

- **Locales** : `fr` (default) + `en`, `fallback: true`.
- **Localized** : editorial text a nonprofit authors — titles, taglines, context/demand, petition text, timeline and tier labels, field-definition labels, pre-written messages.
- **Not localized** : slugs, emails, handles, counters, and everything on the submission/signature side.
- **Never combine `required: true` with `localized: true`** : Payload validates the locale being written and ignores the fallback chain, so saving an English translation would demand every mandatory French field be retyped. Use `requiredInDefaultLocale()` from `src/fields/validation.ts`.
- **The admin interface is not localized** : field labels, descriptions and admin copy stay in English.

## Tests

- **`pnpm test:int`** : Vitest, `tests/int/`. Integration tests through Payload's Local API.
- **`pnpm test:e2e`** : Playwright, `tests/e2e/`. Stop `pnpm dev` first — Next allows one dev server per directory, and `reuseExistingServer` is false so the suite always starts its own.
- **Separate database** : both suites run against `DATABASE_URL_TEST` (see `.env.example`), not the dev database. `vitest.setup.ts` and `playwright.config.ts` each override `DATABASE_URL` before Payload's config is imported.
- **Fixtures clean up after themselves** : each run suffixes slugs and emails with a timestamp and deletes its own rows.

## Skills

- **`payload`** (`.claude/skills/payload/`) : Payload CMS reference — collections, fields, hooks, access control, queries, adapters, endpoints. Start at `SKILL.md`, then `reference/` for detail. Use it for anything touching `payload.config.ts` or a collection, and when debugging validation, access control, relationship queries, transactions or hook behaviour.

## Commands

- **`pnpm install && pnpm dev`** : install dependencies and start the dev server. Needs `.env` (copy `.env.example`).
- **`pnpm seed`** : loads the design handoff's mock data. Idempotent (upserts by natural key, never deletes), but it regenerates array row ids — avoid re-running it on a database that has real submissions.
- **`pnpm generate:types`** : regenerate `src/payload-types.ts` after any schema change.
- **`pnpm format`** : Prettier over the whole repo. Run it before committing.
- **`pnpm lint`** : ESLint (`eslint-config-next`).

## Keeping this file current

- **Say when it's stale** : if something here contradicts the code while you work, raise it instead of silently working around it.
- **Suggest additions** : when a non-obvious choice is made, propose a line for Decisions (or Data model, Routes…) in the same form — `**thing** : short content`, the why rather than the what.
- **Don't log the obvious** : anything readable from the code or git history doesn't belong here.
