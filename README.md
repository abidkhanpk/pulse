# Pulse — Lab Management System

Internal web app for managing labs: desk booking, project management
(projects → milestones → todos, kanban, Gantt), intern/personnel management
with attendance, and daily project logbooks.

**Stack:** Next.js 16 (App Router) · Prisma 6 · Postgres 17 · Auth.js v5
(email+password) · Tailwind 4.

## Quick start

See [RUNBOOK.md](./RUNBOOK.md) — it has the exact commands for setup,
everyday use, deploy (Vercel or VPS, no Docker), backups, and troubleshooting.

```bash
cp .env.example .env   # then fill in real values
npm install
npx prisma migrate deploy
npm run db:seed        # fresh DB only; logins in RUNBOOK.md
npm run dev
```

## Project layout

```
app/
  (auth)/login/          sign-in page
  (app)/                 protected area (sidebar layout)
    dashboard/           today's overview
    desks/               week grid, day timeline, booking drawer
    projects/            list + detail (overview, kanban, gantt, logbook, members)
    logbook/             daily entries, review queue, weekly digest
    people/              roster, person detail, attendance report
    check-in/            one-tap check-in/out
    reports/             monthly attendance reports
    labs/                lab CRUD + incharge assignment (admin)
    settings/            organization + roles (admin)
  api/auth/[...nextauth]/  Auth.js handlers
components/
  ui/                    design-system primitives
  layout/                sidebar, app shell
  desks|projects|logbook|people/  module components
lib/
  permissions.ts         permission catalog, hasPermission/inScope/can
  bookings.ts            recurrence expansion, conflict detection
  auth-helpers.ts        requireUser/requirePermission
  prisma.ts              Prisma client singleton
  audit.ts               audit-log writer
prisma/
  schema.prisma          source of truth for the data model
  seed.ts                realistic demo data (fresh DB only)
```

## Conventions

- All mutations go through **server actions** with zod validation; every
  booking/attendance/logbook write also appends an `AuditLog` row.
- Permission checks (`hasPermission` + `inScope`) run inside every server
  action — never trust the UI alone.
- Timezone: database stores `timestamptz`; the app displays **Asia/Karachi**.
- `.env` is gitignored and never committed; `.env.example` documents variables.
- Migrations are the only schema path (`prisma migrate dev` / `deploy`) —
  never `db push`.
