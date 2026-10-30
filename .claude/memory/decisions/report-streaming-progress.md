---
name: report-streaming-progress
description: Reports stream (oRPC event iterator) panel by panel into the visible page; progress = corner toast (not modal) that stays on failure with reason + retry/close; panel retries save serialised
keywords: [streamReport, retryPanel, progress, eiga, toast, notification, pranešimas, partial, dalinis, event iterator, sse, PANEL_FETCHERS, REPORT_PANEL_KEYS, priežastis]
updated: 2026-10-30
---

### Rule / Fact

- `parcel.streamReport` (oRPC `eventIterator(reportEventSchema)`) replaces `getReport`. Events: `parcel` (outline + address, no panels), one `panel` per source, `report` (final, cached). Cached report = a single `report` event.
- Each panel's lookup is registered in `PANEL_FETCHERS` (report-service.ts), keyed by `REPORT_PANEL_KEYS` in `@zeme/shared` (also the display order). A new panel must be added to both. `fetchPanel` never rejects: a throwing source becomes an error panel, so the rest still arrives.
- Concurrent readers of one rebuild share a `RebuildJob` that replays events; the job finishes and caches even if every reader leaves.
- `parcel.retryPanel` refetches one failed panel from the cached report (only status `error`; an ok panel is returned unchanged), saves on success with pinned `updatedAt`. Sources are asked in parallel but saves of one parcel are serialised (`afterPanelSaves`, re-reads the row), and the web merges only the retried panel, so concurrent retries never undo each other. Not bound by the 3 h cooldown ([[report-refresh-cooldown]]); the web offers it only after the build has finished (needs the saved row).
- Error notes carry the reason via `describeUpstreamError` (upstream-error.ts: "šaltinis neatsakė laiku", "HTTP 503", "nepavyko prisijungti"); the web shows it as "Priežastis: …".
- Web: `useParcelReport` hook; the report renders at once and fills in. `ReportProgress` is a non-modal toast fixed bottom-right (z-1100, above Leaflet's 1000; full-width on phones): shows after 600 ms or on a rebuild, count + progress bar + optional source list; all received → "Visi duomenys gauti" for 3 s then gone; failures → stays with reasons, "Bandyti dar kartą" (all failed panels, or reload when the stream broke) and "Užverti". Closing during loading still lets later failures show. No report at all → page's own failure block + `ExploreMap`, no toast. Pending panels show "Tikrinama…" rows.

### Context & Why

User asked (2026-10-30) for the report to show immediately with progress in a corner notification instead of a modal; earlier the same day for progress on uncached parcels, partial loading, per-source retry, the failure reason per source, and a map even when loading fails. One slow source (forest permits, ~40 s on a cold LKMP dataset) used to hold the whole report.

### Practical Impact

- Streaming needs `proxy_buffering off` on nginx `/rpc` (done) and Bun `idleTimeout` above 10 s ([[bun-idle-timeout]]).
- `ParcelMap` memoises the outline on `report.coordinates`; otherwise every streamed panel re-framed the map.
