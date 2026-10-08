# LOOM — RUNBOOK

Setup, run, deploy, and recovery steps. Every command below is run by **you**
(the human) on your own machine — nothing here is executed by the build agent.

## 1. Prerequisites

- Node.js 20 LTS or newer (`node --version`)
- PostgreSQL 17 (local install, or a hosted Postgres such as Neon)
- Git

## 2. First-time setup (local PC)

```bash
# 1. Clone and enter
git clone <your-repo-url> pulse
cd pulse

# 2. Install dependencies
npm install

# 3. Create the database (local Postgres example)
sudo -u postgres psql -c "CREATE USER pulse WITH PASSWORD 'choose-a-password';"
sudo -u postgres psql -c "CREATE DATABASE pulse_dev OWNER pulse;"

# 4. Configure environment
cp .env.example .env
# then edit .env:
#   DATABASE_URL=postgresql://pulse:choose-a-password@localhost:5432/pulse_dev
#   AUTH_SECRET=$(openssl rand -base64 32)   # generate a fresh one
#   AUTH_URL=http://localhost:3000

# 5. Apply migrations (creates all tables + the no-double-booking constraint)
npx prisma migrate deploy

# 6. Seed demo data (fresh database only)
npm run db:seed
# Seeded logins — password for all: password123
#   admin@pulse.local  (Admin)
#   incharge@pulse.local (Lab Incharge, Vibration Lab)
#   sup1@pulse.local   (Supervisor)
#   intern1@pulse.local … intern8@pulse.local

# 7. Run
npm run dev
# Open http://localhost:3000 — sign in as admin@pulse.local
```

## 3. Everyday commands

| Task | Command |
|---|---|
| Dev server | `npm run dev` |
| Production build | `npm run build` |
| Lint | `npm run lint` |
| Typecheck | `npx tsc --noEmit` |
| New migration after schema edit | `npx prisma migrate dev --name <what-changed>` |
| Apply migrations (deploy/prod) | `npx prisma migrate deploy` |
| Open DB GUI | `npx prisma studio` |
| Re-seed (fresh DB only) | `npm run db:seed` |

## 4. Deploy — Option A: Vercel

1. Create a hosted Postgres 17 database (Neon free tier works).
2. Run migrations against it once from your PC:
   `DATABASE_URL="<neon-url>" npx prisma migrate deploy`
3. Push the repo to GitHub, import into Vercel.
4. Set environment variables in Vercel: `DATABASE_URL` (Neon URL),
   `AUTH_SECRET` (fresh `openssl rand -base64 32`), `AUTH_URL` (your Vercel URL).
5. Deploy. No code changes needed.

## 5. Deploy — Option B: VPS (direct, no Docker)

```bash
# on the VPS: install Node 20+ and PostgreSQL 17, create DB + user (see §2 step 3)
git clone <your-repo-url> pulse && cd pulse
npm ci
cp .env.example .env   # fill in production values
npx prisma migrate deploy
npm run build
# run with pm2 (or a systemd unit):
npm install -g pm2
pm2 start npm --name pulse -- start
pm2 save && pm2 startup
# put Caddy or Nginx in front for TLS, pointing at http://127.0.0.1:3000
```

## 6. Backup & restore

```bash
# nightly backup (cron example, keeps 7 days)
0 2 * * * pg_dump -Fc pulse_dev > /backups/pulse-$(date +\%F).dump && find /backups -name 'pulse-*.dump' -mtime +7 -delete

# restore
pg_restore -c -d pulse_dev /backups/pulse-YYYY-MM-DD.dump
```

## 7. Operations

- **Extend a recurring booking:** Desks → click the booking → edit → change "valid until".
- **Add a user:** People → Add person (admin: anyone; lab incharge: own labs only).
- **Reset a password:** People → person → set a new password (admin/incharge).
- **Deactivate a user:** People → person → status → Inactive (access ends immediately —
  the app uses JWT sessions and rechecks the active flag against the database on every
  protected request).

## 8. Troubleshooting

- `P1001 Can't reach database` → check `DATABASE_URL` and that Postgres is running.
- Login loops back to `/login` → `AUTH_SECRET` missing/changed, or cookies blocked.
- `booking would overlap` errors → the no-double-booking constraint fired; pick another slot.
- Port 3000 in use → `npx kill-port 3000` or `npm run dev -- -p 3001`.
