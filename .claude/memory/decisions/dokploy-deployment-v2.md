---
name: dokploy-deployment
description: Deployment target is Dokploy via GitHub; docker-compose with server + reginfo(web) nginx services. Confirmed working.
keywords: [dokploy, deploy, docker, docker-compose, github, server, web, nginx, puppeteer, bun]
created: 2026-06-01
updated: 2026-06-01
---

**Fact / Rule:** Project deploys to Dokploy from GitHub using `docker-compose.yml` (Compose application type). Confirmed working.

**Why:** Two-service monorepo (Bun/Hono server + React/Vite web) is cleanest as a Compose stack in Dokploy.

**Files:** `Dockerfile.server`, `Dockerfile.web`, `nginx.conf`, `docker-compose.yml`, `.env.example`

**Critical gotchas learned:**
- Dokploy domain config must match compose service name exactly → web service named `reginfo` (not `web`)
- Dokploy manages ports via its own Traefik reverse proxy → do NOT use `ports:` in compose
- Copy ALL workspace `package.json` files before `bun install` (server + web + shared) — otherwise lockfile mismatch
- Puppeteer postinstall downloads Chrome; use `--ignore-scripts` in Docker for both Dockerfiles
- For local dev, `prepare` script in `apps/server/package.json`: `"puppeteer browsers install chrome"`
- `generate:biip` script: use `bunx` not `npx` — Docker image has no npx
- `scripts/` dir must NOT be in `.dockerignore` — needed for `bun run generate:biip` in builder
- No healthcheck needed — simple `depends_on: - server` is sufficient
- After any `package.json` change, run `bun install` locally and commit the updated `bun.lock`

**Dokploy setup:**
1. New → Compose → GitHub repo → branch `main`
2. Env vars: `DATABASE_URL`, `BIIP_BASE_URL`, `DISABLE_PDF`
3. Domain → assign to `reginfo` service → port 80
