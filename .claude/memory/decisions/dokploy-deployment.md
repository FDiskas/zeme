---
name: dokploy-deployment
description: Deployment target is Dokploy via GitHub; docker-compose with server + reginfo(web) nginx services. Confirmed working.
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
    bun,
  ]
created: 2026-06-01
updated: 2026-09-26
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
- `apps/server/package.json` pins `prisma`/`@prisma/client` to `"latest"` each — risky: `bun add <anything-else>` re-resolves every `"latest"` dependency and can silently jump one of the pair to a pre-release major (hit live: `bun add stream-json` pulled `@prisma/client@7.10.0` + `prisma@8.0.0-rc.17`, an incompatible mismatch that broke `import { PrismaClient }`). Fixed by pinning both to the same explicit version (`7.10.0`). After ANY `bun add`, diff `bun.lock` for `prisma@`/`@prisma/client@` and re-run `bun run db:generate` + a typecheck before trusting the install.
- Same `"latest"` class of bug hit `typescript` (2026-09-26): `apps/server/package.json` had `"typescript": "latest"`, which resolved to TS 7.0.2 (the new native/rewritten compiler) and got hoisted to the workspace root by bun. That broke `bunx openapi-ts` inside `Dockerfile.server`'s `bun run generate:biip` step — it crashed with `TypeError: Cannot read properties of undefined (reading 'LineFeed')` because `@hey-api/openapi-ts@0.97.2` uses the TS 5/6-era compiler API (`ts.NewLineKind`) that TS 7 removed/changed. `apps/web` was fine because it pins `typescript` to `~6.0.2` locally. Fix: pin `apps/server`'s `typescript` to `~6.0.2` too (match web) instead of `"latest"`. General rule: avoid `"latest"` for `typescript`/`prisma`/`@prisma/client` in this repo — pin explicit/range versions and bump deliberately.

**Dokploy setup:**

1. New → Compose → GitHub repo → branch `main`
2. Env vars: `DATABASE_URL`, `BIIP_BASE_URL`, `DISABLE_PDF`
3. Domain → assign to `reginfo` service → port 80
