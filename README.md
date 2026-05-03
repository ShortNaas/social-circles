# Social Circles

A personal CRM for staying in touch with the people who matter based on [Derek Siver's](https://sive.rs/hundreds) article. Social Circles helps you track contacts, schedule follow-ups, get birthday reminders, and receive a weekly digest — so no relationship slips through the cracks.

🌐 **Live app:** [social-circles.naas.work](https://social-circles.naas.work)

---

## Features

- **Dashboard** — birthday-today banner, overdue contacts, upcoming birthdays, and relationship stats
- **Contact management** — health score indicators (green/yellow/red), last note preview, tags, quick notes, snooze, and bulk actions
- **Contact detail** — interaction timeline, contact info (email, phone, social, address) with copy-on-hover, tag editing, info change history, birthday, and next follow-up with iCal download
- **CSV import/export** — bulk import or export your contacts
- **Weekly digest email** — automated email summary of who you should reach out to
- **iCal feed** — subscribe to your follow-up schedule in any calendar app
- **Tiered contacts** — organize by relationship tier with customizable follow-up intervals

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite |
| Backend | Express 5 (Node.js 24) |
| Database | PostgreSQL + Drizzle ORM |
| Auth | Clerk |
| Email | Resend |
| Validation | Zod v4, drizzle-zod |
| API codegen | Orval (from OpenAPI spec) |
| Build | esbuild |
| Monorepo | pnpm workspaces |
| Language | TypeScript 5.9 |

---

## Project Structure

```
social-circles/
├── artifacts/
│   ├── social-circle/      # React frontend (deployed to Vercel)
│   └── api-server/         # Express API server (deployed to Render)
├── lib/
│   ├── db/                 # Drizzle schema + migrations
│   ├── api-spec/           # OpenAPI spec
│   └── api-zod/            # Auto-generated Zod schemas + React hooks
├── scripts/                # Utility scripts
├── vercel.json             # Vercel deployment config
└── render.yaml             # Render deployment config
```

---

## Local Development

### Prerequisites

- Node.js 24+
- pnpm
- A PostgreSQL database (local or [Neon](https://neon.tech))
- A [Clerk](https://clerk.com) account (development instance)

### 1. Clone and install

```bash
git clone https://github.com/ShortNaas/social-circles.git
cd social-circles
pnpm install
```

### 2. Set up environment variables

Create a `.env` file in `artifacts/api-server/`:

```env
DATABASE_URL=postgresql://...
CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...
SESSION_SECRET=your-random-secret
CORS_ORIGIN=http://localhost:5173
RESEND_API_KEY=re_...
CRON_SECRET=your-cron-secret
DIGEST_FROM_EMAIL=hello@yourdomain.com
APP_URL=http://localhost:5173
```

Create a `.env` file in `artifacts/social-circle/`:

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

### 3. Push the database schema

```bash
DATABASE_URL="your-db-url" pnpm --filter @workspace/db run push
```

### 4. Run the API server

```bash
pnpm --filter @workspace/api-server run dev
```

### 5. Run the frontend

```bash
pnpm --filter @workspace/social-circle run dev
```

The app will be available at `http://localhost:5173`.

---

## Key Commands

| Command | Description |
|---|---|
| `pnpm run typecheck` | Full typecheck across all packages |
| `pnpm run build` | Typecheck + build all packages |
| `pnpm --filter @workspace/api-spec run codegen` | Regenerate API hooks and Zod schemas from OpenAPI spec |
| `pnpm --filter @workspace/db run push` | Push DB schema changes (dev only) |
| `pnpm --filter @workspace/api-server run dev` | Run API server locally |

---

## API Routes

| Method | Route | Description |
|---|---|---|
| GET | `/api/contacts` | List contacts (add `?archived=true` for archive) |
| POST | `/api/contacts` | Create a contact |
| PATCH | `/api/contacts/:id` | Update contact fields |
| DELETE | `/api/contacts/:id` | Delete a contact |
| POST | `/api/contacts/:id/touch` | Mark as reached out |
| POST | `/api/contacts/:id/archive` | Archive a contact |
| POST | `/api/contacts/:id/unarchive` | Restore a contact |
| GET | `/api/contacts/:id/info-history` | Field change history |
| GET | `/api/contacts/stats` | Tier counts (excludes archived) |
| GET | `/api/contacts/due` | Overdue contacts |
| GET | `/api/contacts/export` | CSV export |
| POST | `/api/contacts/import` | CSV import |
| POST | `/api/digest` | Send weekly digest to current user |
| POST | `/api/digest/cron` | Send digest to all users (requires `x-cron-secret`) |
| GET | `/api/calendar/token` | Get iCal feed URL |
| GET | `/api/calendar/feed.ics` | Serve iCal feed |

---

## Deployment

The app is split across three services:

```
[Users] → [Vercel - Frontend] → [Render - API] → [Neon - Database]
                    ↕
              [Clerk - Auth]
```

### Frontend → Vercel

1. Import the repo on [vercel.com](https://vercel.com)
2. Vercel auto-detects `vercel.json` — do not override build settings
3. Add environment variable: `VITE_CLERK_PUBLISHABLE_KEY=pk_live_...`
4. Add your custom domain and point DNS CNAME to `cname.vercel-dns.com`

### Backend → Render

1. New Web Service on [render.com](https://render.com), connect this repo
2. Configure:
   - **Build command:** `pnpm install --frozen-lockfile && pnpm --filter @workspace/api-server run build`
   - **Start command:** `node artifacts/api-server/dist/index.mjs`
   - **Instance type:** Free
3. Add environment variables:

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Neon connection string |
| `CLERK_SECRET_KEY` | `sk_live_...` |
| `CLERK_PUBLISHABLE_KEY` | `pk_live_...` |
| `SESSION_SECRET` | 64-char random string |
| `CORS_ORIGIN` | Your Vercel domain |
| `RESEND_API_KEY` | From resend.com |
| `CRON_SECRET` | Random string |
| `DIGEST_FROM_EMAIL` | Verified sender email |
| `APP_URL` | Your Vercel domain |

4. Copy your Render URL and update `vercel.json`:
```json
"destination": "https://your-render-app.onrender.com/api/:path*"
```

### Database → Neon

1. Create a free project on [neon.tech](https://neon.tech)
2. Copy the connection string as `DATABASE_URL`
3. After Render is live, run schema migration once locally:
```bash
DATABASE_URL="your-neon-url" pnpm --filter @workspace/db run push
```

---

## Contributing

```bash
# Always branch off dev, not main
git checkout dev
git checkout -b feature/your-feature-name

# After your work is done
git push origin feature/your-feature-name
# Open a Pull Request → dev
```

Branch naming: `feature/`, `fix/`, `chore/`, `hotfix/`

---

## License

Private project — all rights reserved.
