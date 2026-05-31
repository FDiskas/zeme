# Zeme – Lithuanian Real Estate Due Diligence

> Monorepo (Bun workspaces) · oRPC · Prisma SQLite · React + Tailwind v4 · React-Leaflet

---

## Architecture

```
apps/
  server/   Bun HTTP server, oRPC router, Prisma cache layer, Puppeteer PDF renderer
  web/      Vite + React SPA, oRPC client, Leaflet map, Tailwind v4
packages/
  shared/   Zod schemas, shared TypeScript types (no runtime, import via workspace:*)
```

### Data Flow

```
User searches address
  → oRPC parcel.autocomplete
  → Returns mock/upstream candidates with centre coords

User selects parcel
  → URL changes to /parcel/:cadastralRegNo (shareable link)
  → oRPC parcel.getReport
  → Checks Prisma cache (6-month freshness window)
  → Fresh: runs parallel connectors (BIIP, Geoportal WFS, KVR, PDBIS, Puppeteer scraper)
  → Renders PDF via Puppeteer, stores in /generated/pdf/
  → Persists to SQLite via Prisma
  → Returns ParcelReport JSON
  → Frontend renders Leaflet map + accordion panels + history
```

---

## Development

```bash
# 1. Bootstrap deps + DB
bun install
bun run db:generate   # prisma generate
bun run db:push       # prisma db push (creates dev.db)

# 2. Start both services
bun run dev:server    # http://localhost:8787
bun run dev:web       # http://localhost:5173  (proxy → server)
```

Environment variables are validated with `env.t3.gg` before the server starts or Prisma commands run.
For local development, copy `.env.example` in `apps/server` only if you want to override the defaults.

| Key            | Default                          | Description                                 |
| -------------- | -------------------------------- | ------------------------------------------- |
| `PORT`         | `8787`                           | Server port                                 |
| `DATABASE_URL` | `file:apps/server/prisma/dev.db` | SQLite or libSQL connection string          |
| `DISABLE_PDF`  | `false`                          | Set `true` to skip Puppeteer PDF generation |

Use `bun run check-env` from the repo root to validate the effective environment without starting the app.

---

## API

All procedures live at `POST /rpc/{path}` (oRPC standard protocol).

| Procedure             | Input                               | Output               |
| --------------------- | ----------------------------------- | -------------------- |
| `parcel.autocomplete` | `{ query: string }`                 | `ParcelSearchItem[]` |
| `parcel.getReport`    | `{ cadastralRegNo, forceRefresh? }` | `ParcelReport`       |

---

## Production build

```bash
bun run build:server  # apps/server/dist/
cd apps/web && bun run build  # apps/web/dist/
```
