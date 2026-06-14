---
name: no-fabricated-address-or-geometry
description: Never fabricate parcel address/outline; show admin area or centre coordinates honestly instead
keywords: address, adresas, fabricated, fake, placeholder, buildUnknownAddress, generateRealisticPolygon, getDeterministicCenter, hasStreetAddress, koordinatės, geometry, sklypas be adreso
created: 2026-06-14
updated: 2026-06-14
---

**Decision:** The cadastral-lookup path must **never fabricate** an address or an outline. A plausible-looking fake (e.g. hashed "Gedimino pr. 42, Vilnius") is worse than an honest "no address" because the user can't tell it's fake and trusts it — kills the tool's credibility for its elderly audience.

Honest hierarchy for the address heading:
1. Real street address (BIIP `fullAddress`) → `hasStreetAddress = true`.
2. No street address but region known → administrative-area label (`savivaldybė, seniūnija`), `hasStreetAddress` false/absent.
3. Nothing → empty `address` ""; UI shows "Žemės sklypas be priskirto adreso".

When `hasStreetAddress === false`, `SummaryCard` shows the parcel-centre coordinates ("Sklypo centras: lat, lng") as a secondary locator via `parcelCenter()`. No usable geometry → server sends empty polygon (`coordinates: []`), so `ParcelMap` renders its honest "nėra ribų" state instead of a pin at a fake point.

**Why:** User report (2026-06-14): parcels with no real address showed a random, non-matching fabricated address. Removed `buildUnknownAddress` and `getDeterministicCenter`; report-service no longer builds a degenerate `[[center]]` polygon.

**How to apply:** `hasStreetAddress` is a new optional field on `parcelReportSchema` (packages/shared). Set in `buildComprehensiveReport` (report-service.ts) — only BIIP fullAddress sets it true; OSP path gives an area label. `isPlaceholderAddress` treats "" as NOT a placeholder (valid empty state) but still catches legacy `Parcel …` / `Address unavailable …` so old cache rebuilds clean. **Still fabricates (not yet fixed):** `buildFromNominatim` in autocomplete.ts synthesizes a fake cadastral number + `generateRealisticPolygon` outline for free-text address search — separate feature, flagged for later. Related: [[report-display-rules]], [[ui-lithuanian-and-curation-layer]].
