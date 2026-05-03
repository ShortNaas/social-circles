# Workspace

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
- **Auth**: Clerk (JWT via Bearer token in Express, `@clerk/react` in Vite)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run typecheck:libs` — build composite libs only (fast)
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Codegen Notes

After running codegen, check `lib/api-zod/src/index.ts` — orval sometimes wrongly adds `export * from "./generated/api.schemas"` which only exists in `api-client-react`. Keep `api-zod/src/index.ts` as:
```ts
export * from "./generated/api";
```

## Social Circle App

**Artifact**: `artifacts/social-circle` (React + Vite, path: `/`)
**API**: `artifacts/api-server` (Express, path: `/api`)
**DB schema**: `lib/db/src/schema/` — contacts + interactions tables

### Features

- **Contacts** — name, tier (Core/Monthly/Yearly), relationship type, interval, notes, birthday, tags, streak, archivedAt
- **Interaction Log** — structured per-contact log (type: call/email/coffee/message/video_call/other, date, notes)
- **Tags** — inline tag editor with pill display; filterable in search
- **Relationship Streaks** — flame counter increments when you touch on time, resets if late
- **Archived Contacts** — archive/restore flow; "Archived" tab in contacts list
- **CSV Export** — full export including tags, birthday, streak (uses Bearer auth via `useAuthFetch`)
- **CSV Import** — frontend-only CSV parser → batch POST /contacts
- **iCal feeds** — per-contact and global calendar feed
- **Footer** — "made by naas.work with replit.com"

### Important files

- `artifacts/api-server/src/routes/contacts.ts` — all contact CRUD, touch, archive, export
- `artifacts/api-server/src/routes/interactions.ts` — interaction CRUD
- `artifacts/social-circle/src/pages/contacts.tsx` — contacts list with CSV import/export, archived tab
- `artifacts/social-circle/src/pages/contact-detail.tsx` — contact detail with streak, tags, archive, interaction log
- `artifacts/social-circle/src/components/interaction-log.tsx` — structured interaction log component
- `artifacts/social-circle/src/components/tag-editor.tsx` — tag pill input component
- `artifacts/social-circle/src/hooks/use-auth-fetch.ts` — raw fetch with Clerk Bearer token
- `lib/db/src/schema/contacts.ts` — contacts table (includes tags[], streak, archivedAt, birthday)
- `lib/db/src/schema/interactions.ts` — interactions table
- `lib/api-spec/openapi.yaml` — source of truth for all API contracts
