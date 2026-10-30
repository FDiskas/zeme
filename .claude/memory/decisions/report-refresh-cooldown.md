---
name: report-refresh-cooldown
description: A parcel's report is rebuilt from upstream at most once per 3 h; enforced on the server, the UI only mirrors it
keywords: [atnaujinti, refresh, forceRefresh, cooldown, rate limit, apsauga, upstream, getReport, refreshAvailableAt]
updated: 2026-10-30
---

### Rule / Fact

`REPORT_REFRESH_COOLDOWN_MS` (3 h, `@zeme/shared`) limits rebuilds per cadastral number. In `parcel.streamReport` ([apps/server/src/router.ts](apps/server/src/router.ts)) a `forceRefresh` within 3 h of the cached row's `updatedAt` is answered from the cache. Concurrent rebuilds of one parcel share one `RebuildJob` (`rebuildsInFlight`). Every response carries `refreshAvailableAt` (computed per response, never stored). The web page hides the ↻ key until then, showing "galėsite po HH:MM", and a timer brings them back.

### Context & Why

The user asked for it as a protection (2026-10-26): each rebuild queries about twenty public registries. The browser check alone could be bypassed, so the server is the authority.

### Practical Impact

- Background cache writes (`refreshMissingMarketValue`, `upgradeCachedReport`) pin `updatedAt`, so they don't reset the window.
- A cache that is missing or unusable (no geometry, placeholder address) is rebuilt regardless of the window.
- A failed panel is retried on its own (`parcel.retryPanel`, one source) and is not held to this window; see [[report-streaming-progress]].
