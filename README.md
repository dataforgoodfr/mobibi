# mobibi

**Mobilisation citoyenne.** A platform where nonprofits run campaigns and citizens act on them.

Two kinds of mobilisation:

- **Interpellation** — citizens write to elected officials (email, Twitter, etc.) using a pre-written message, then declare they did it.
- **Petition** — citizens sign a text, and the count progresses toward tiers.

## Getting started

You need Node 22, pnpm 11, and an empty Postgres database — Payload creates the tables, but not the database itself.

```bash
cp .env.example .env      # set DATABASE_URL (and DATABASE_URL_TEST)
pnpm install && pnpm dev
```

Open http://localhost:3000/admin and follow the prompts to create the first admin. Then `pnpm seed` loads sample campaigns.

## Stack

Next.js 16 · Payload CMS 3 · Postgres · React 19 · Tailwind CSS 4
