---
name: dokploy-deployment
description: Deployment target is Dokploy via GitHub; docker-compose with server + web nginx services.
keywords:
  [
    dokploy,
    deploy,
    docker,
    docker-compose,
    github,
    server,
    web,
    nginx,
    puppeteer,
    turso,
  ]
created: 2026-06-01
updated: 2026-06-01
---

**Fact / Rule:** Project deploys to Dokploy from GitHub using `docker-compose.yml` (Compose application type).

**Why:** Two-service monorepo (Bun/Hono server + React/Vite web) is cleanest as a Compose stack in Dokploy.

**Files created:**

- `Dockerfile.server` — Bun runtime + system Chromium for Puppeteer; runs `bun run src/index.ts` from `/app/apps/server`
- `Dockerfile.web` — Vite build → Nginx alpine; proxies `/rpc` and `/api` to `server` container
- `nginx.conf` — SPA fallback + reverse proxy to `http://server:8787`
- `docker-compose.yml` — `server` + `web` services; named volumes for SQLite db and PDFs
- `.env.example` — documents all env vars

**Key decisions:**

- `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true` + system `chromium` package to avoid re-downloading Chrome in Docker
- `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium` set in server container
- Set `DISABLE_PDF=true` to skip Chromium entirely (lighter image)
- Database: `DATABASE_URL=file:./prisma/dev.db` for SQLite (needs volume) or Turso cloud URL (`libsql://...?authToken=...`) for stateless prod

**Dokploy setup steps:**

1. Push files to GitHub
2. Dokploy → New → Compose → GitHub repo → branch `main`
3. Set env vars: `DATABASE_URL`, `BIIP_BASE_URL`, `DISABLE_PDF`, `WEB_PORT`
4. Deploy; Dokploy builds both images and starts stack
