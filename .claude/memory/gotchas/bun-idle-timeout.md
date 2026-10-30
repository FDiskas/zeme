---
name: bun-idle-timeout
description: Bun.serve closes a connection idle for 10 s by default; long non-streamed handlers (report build, PDF) were cut off and the page showed "Nepavyko gauti sklypo duomenų"
keywords: [bun, idleTimeout, timeout, 10 s, nepavyko gauti, report, pdf, sse, keep-alive]
updated: 2026-10-30
---

### Rule / Fact

`Bun.serve` in apps/server/src/index.ts sets `idleTimeout: 120`. Without it, Bun drops a request whose handler sends nothing for 10 s.

### Context & Why

A cold report build took 40 s+ (forest-permit dataset load), so the whole report failed with no map. Streamed reports also send oRPC keep-alives every 5 s.

### Practical Impact

Any new long-running endpoint must stream or finish within 120 s (Bun's maximum is 255). nginx `/rpc` has `proxy_read_timeout 120s` to match.
