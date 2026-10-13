# Pakti

A whole-life growth, planning and accountability companion. Next.js 16 (App
Router, TypeScript), Supabase (Postgres, Auth, Storage, RLS), deployed on Vercel.

The product architecture and V1 scope live in the Pakti architecture doc
(section 15 is the build contract).

## Local setup

Requirements: Node 22+, Docker Desktop running.

```bash
npm install
npm run db:start          # starts local Supabase and applies every migration
npx supabase status       # copy the API URL, publishable and secret keys
cp .env.example .env.local  # then paste the values from `supabase status`
npm run db:types          # generate TypeScript types from the schema
npm run dev               # http://localhost:3000
```

Magic-link emails are caught locally by Mailpit at http://127.0.0.1:54324.

## Checks

| Command | What it runs |
| --- | --- |
| `npm run lint` | ESLint |
| `npm run typecheck` | Next route types + `tsc` |
| `npm test` | Vitest unit tests (`src/**/*.test.ts`) |
| `npm run db:test` | pgTAP security and constraint tests (`supabase/tests/database`) |
| `npm run db:lint` | Supabase schema linter |
| `npm run db:reset` | Rebuild the local database from migrations |

CI (`.github/workflows/ci.yml`) runs all of these on every pull request.

## Layout

```
src/
  app/                 routes (sign-in, auth/confirm, auth/sign-out, week, styleguide)
  components/ui/       Button, Card, Field/Input/Textarea, Chip/Tag, ProgressLine, Sheet
  lib/
    env.ts             public env (validated)
    env.server.ts      server-only secrets (server-only import guard)
    supabase/          browser, server, proxy and admin clients + generated types
    auth/              current-member DAL, safe redirect helper
    domain/            life capitals, week/quarter date maths
  proxy.ts             session refresh + signed-out redirect (Next 16 "proxy")
supabase/
  migrations/          the schema, RLS and storage policies, in order
  tests/database/      pgTAP tests
```

## Data principles

- Raw facts only: progress is always calculated from `activity_logs`, never stored.
- Weeks are Monday to Sunday, keyed by `week_start`; quarters by `quarter_start`. Neither is a table.
- Private by default. Partners never read member tables; they read frozen check-in snapshots through `partner_checkins()`.
- Evidence is private: owner-only rows and an owner-only storage folder, with no partner path.

## Environment variables

| Name | Where | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | Supabase API URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | browser + server | Publishable (anon) key; RLS protects data |
| `NEXT_PUBLIC_SITE_URL` | browser + server | Used to build magic-link redirect URLs |
| `SUPABASE_SECRET_KEY` | server only | Bypasses RLS. Never `NEXT_PUBLIC_`. Mark Sensitive on Vercel |
