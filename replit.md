# Social Circle Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Auth**: Clerk (`@clerk/express` on API, `@clerk/react` on frontend)
- **Email**: Resend (`resend` package)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec (also patches api-zod/src/index.ts)
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Deployment

- **Frontend**: Vercel (artifacts/social-circle)
- **API**: Render (artifacts/api-server) — `render.yaml` defines services
- **Database**: Neon (production), local Replit PostgreSQL (dev)

## API Routes (artifacts/api-server)

- `GET /api/contacts` — list contacts (exclude archived by default; `?archived=true` for archive)
- `POST /api/contacts` — create contact
- `PATCH /api/contacts/:id` — update contact (email, phone, linkedin, twitter, instagram, address, tags, notes, tier, etc.)
- `DELETE /api/contacts/:id` — delete contact
- `POST /api/contacts/:id/touch` — mark as reached out
- `POST /api/contacts/:id/archive` — archive contact
- `POST /api/contacts/:id/unarchive` — restore contact
- `GET /api/contacts/:id/info-history` — contact info field change history
- `GET /api/contacts/stats` — tier counts (excludes archived)
- `GET /api/contacts/due` — overdue contacts (excludes archived)
- `GET /api/contacts/export` — CSV export (excludes archived)
- `POST /api/contacts/import` — CSV import
- `POST /api/digest` — authenticated: send weekly digest email to current user
- `POST /api/digest/cron` — protected by `x-cron-secret` header: send digest to all users
- `GET /api/calendar/token` — get iCal feed URL
- `GET /api/calendar/feed.ics` — serve iCal feed

## DB Schema (lib/db/src/schema/contacts.ts)

**contacts table**: `id`, `userId`, `name`, `tier`, `intervalDays`, `relationshipType`, `lastContactDate`, `nextContactDate`, `notes`, `birthday`, `email`, `phone`, `linkedin`, `twitter`, `instagram`, `address`, `tags` (JSON string of string[]), `archivedAt`, `createdAt`, `updatedAt`.

**contact_info_history table**: `id`, `contactId`, `field`, `oldValue`, `newValue`, `changedAt` — auto-logged whenever tracked info fields (email, phone, linkedin, twitter, instagram, address) change via PATCH.

## Tags

Tags are stored in the `tags` column as a JSON string (e.g. `'["mentor","friend"]'`). The API server parses/serializes this automatically. The OpenAPI/Zod types expose `tags` as `string[] | null`.

## Codegen Note

The `lib/api-zod` orval config uses `mode: "single"` to avoid split output. The codegen script patches `lib/api-zod/src/index.ts` after each run to ensure it only exports from `./generated/api` (not the non-existent `api.schemas`).

## Render Env Vars Required

- `DATABASE_URL` — Neon connection string
- `CLERK_SECRET_KEY` — Clerk backend secret
- `CLERK_PUBLISHABLE_KEY` — Clerk publishable key
- `SESSION_SECRET` — random secret
- `CORS_ORIGIN` — Vercel frontend URL
- `RESEND_API_KEY` — for weekly digest emails
- `CRON_SECRET` — random secret for digest/cron endpoint protection
- `DIGEST_FROM_EMAIL` — sender email (must be verified on Resend)
- `APP_URL` — Vercel frontend URL (used in digest email links)

## Frontend Features (artifacts/social-circle)

- **Dashboard**: birthday-today banner, due contacts, upcoming birthdays, stats
- **Contacts list**: health score dots (green/yellow/red), last note preview, tags badges, quick note button (MessageSquare icon), snooze, bulk actions (reach out / archive / delete)
- **Contact detail**: interaction history timeline, contact info section (email/phone/social/address with copy-on-hover), tags (add/remove inline), contact info change history, birthday, next follow-up with iCal download
