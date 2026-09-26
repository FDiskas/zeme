---
name: no-fabricated-address-or-geometry
description: Never fabricate parcel address/outline; show admin area or centre coordinates honestly instead
keywords: address, adresas, fabricated, fake, placeholder, buildUnknownAddress, generateRealisticPolygon, getDeterministicCenter, hasStreetAddress, koordinatės, geometry, sklypas be adreso, buildFromNominatim, cadastral collision, cache poisoning
created: 2026-06-14
updated: 2026-09-26
---

**Decision:** The cadastral-lookup path must **never fabricate** an address or an outline. A plausible-looking fake (e.g. hashed "Gedimino pr. 42, Vilnius") is worse than an honest "no address" because the user can't tell it's fake and trusts it — kills the tool's credibility for its elderly audience.

Honest hierarchy for the address heading:
1. Real street address (BIIP `fullAddress`) → `hasStreetAddress = true`.
2. No street address but region known → administrative-area label (`savivaldybė, seniūnija`), `hasStreetAddress` false/absent.
3. Nothing → empty `address` ""; UI shows "Žemės sklypas be priskirto adreso".

When `hasStreetAddress === false`, `SummaryCard` shows the parcel-centre coordinates ("Sklypo centras: lat, lng") as a secondary locator via `parcelCenter()`. No usable geometry → server sends empty polygon (`coordinates: []`), so `ParcelMap` renders its honest "nėra ribų" state instead of a pin at a fake point.

**Why:** User report (2026-06-14): parcels with no real address showed a random, non-matching fabricated address. Removed `buildUnknownAddress` and `getDeterministicCenter`; report-service no longer builds a degenerate `[[center]]` polygon.

**How to apply:** `hasStreetAddress` is a new optional field on `parcelReportSchema` (packages/shared). Set in `buildComprehensiveReport` (report-service.ts) — only BIIP fullAddress sets it true; OSP path gives an area label. `isPlaceholderAddress` treats "" as NOT a placeholder (valid empty state) but still catches legacy `Parcel …` / `Address unavailable …` so old cache rebuilds clean.

**Fixed (2026-09-26):** the previously-flagged `buildFromNominatim` gap was a real, reported bug — it hashed the OSM address string into a fake cadastral number `4400/0001:XXXX` (only 9999 possible values) and blind-upserted onto whatever `ParcelReport` row already had that key, silently overwriting an unrelated real parcel's cached address (e.g. a Vilniaus-rajono forest parcel showing "Gedimino pr. 11, Panevėžys"). Fixed by resolving the real parcel via `resolveParcelByCoordinates(lon, lat)` (BIIP point-intersects) instead of fabricating a key; returns `null` (no autocomplete suggestion) when no real parcel resolves, rather than caching a guess. One-off DB repair: `bun run clear-parcel-report-cache` (apps/server/src/scripts/clear-parcel-report-cache.ts) wipes the whole `ParcelReport` cache table — deliberately simple (user's call: "gal paprasciau tiesiog visus irasus istrint?") since every row is fully re-derivable from BIIP/OSP, so a targeted mismatch-detection repair script was unnecessary complexity for a pure cache table. Related: [[report-display-rules]], [[ui-lithuanian-and-curation-layer]].
