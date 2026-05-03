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
- `PUT /api/contacts/:id` — update contact
- `DELETE /api/contacts/:id` — delete contact
- `POST /api/contacts/:id/touch` — mark as reached out
- `POST /api/contacts/:id/archive` — archive contact
- `POST /api/contacts/:id/unarchive` — restore contact
- `GET /api/contacts/stats` — tier counts (excludes archived)
- `GET /api/contacts/due` — overdue contacts (excludes archived)
- `GET /api/contacts/export` — CSV export (excludes archived)
- `POST /api/contacts/import` — CSV import
- `POST /api/digest` — authenticated: send weekly digest email to current user
- `POST /api/digest/cron` — protected by `x-cron-secret` header: send digest to all users
- `GET /api/calendar/token` — get iCal feed URL
- `GET /api/calendar/feed.ics` — serve iCal feed

## DB Schema (lib/db/src/schema/contacts.ts)

Contacts table includes: `id`, `userId`, `name`, `tier`, `intervalDays`, `relationshipType`, `lastContactDate`, `nextContactDate`, `notes`, `birthday`, `archivedAt`, `snoozedUntil`, `createdAt`, `updatedAt`.

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
