# BDCAT Analytics

Modern BDCAT workspace — React + Hono, dual MySQL databases, fluid Explore UX.

## Architecture

| Piece | Detail |
|---|---|
| Web | Vite + React + Tailwind + shadcn-style UI + TanStack Query + Zustand |
| API | Hono on Node (`:3001`) |
| System DB | `bdcat_system` on existing `bdcat-mysql` (users, settings, saved views) |
| Knowledge DB | `stt_electorals` — **read-only**, schema never altered |

## Prerequisites

- Node 22+
- `bdcat-mysql` running (from `/Users/shameerulauraez/Documents/dev/bdcat`)

## Setup

```bash
cd /Users/shameerulauraez/Documents/dev/analytics
cp .env.example .env
cp .env.example apps/api/.env   # Prisma CLI reads apps/api/.env
npm install
npm run db:setup                # creates bdcat_system + pushes schema + seeds admin
```

`db:setup` uses `prisma db push` against **`bdcat_system` only**. It never alters `stt_electorals`.

## Dev

```bash
# terminal 1
npm run dev:api

# terminal 2
npm run dev:web
```

- UI: http://localhost:5173  
- API: http://localhost:3001  

Default seed admin (change after first login):

- Email: `admin@bdcat.local`
- Password: `bdcat-admin-change-me`

## Explore (Phase 2)

- GE15 parliament KPIs + party seat chart from `stt_electorals` (read-only)
- National map = seat center points; pick a **state** for MultiPolygon detail
- Click a seat → drill-down sheet (member, turnout, majority)
- State filter syncs to `?state=` URL for share/refresh

## Library (Phase 3)

- Save Explore workspace (state, seat, map mode, compare) into `bdcat_system.SavedView`
- `/library` lists, opens, and deletes your views
- Open restores Explore via `?view=` (+ live knowledge queries)

## Admin & Profile (Phase 4)

- `/admin` (ADMIN only): list users, create, change role, delete (guards last admin / self)
- `/profile`: update display name, change password
- Admin nav/command item hidden for non-admins

## Ports

Node binds ports directly (no Apache/Nginx in Phase 1):

- Vite `5173` (proxies `/api` → API)
- Hono `3001`
