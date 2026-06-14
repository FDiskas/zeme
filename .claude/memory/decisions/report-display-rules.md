---
name: report-display-rules
description: Identity-number, Paskirtis-source, and Šaltinis-visibility rules in the report curation/render layer
keywords: report, summary, sklypo apžvalga, unikalus numeris, kadastrinis, paskirtis, naudojimo būdas, šaltinis, source, įrašų nerasta, curation, display
created: 2026-06-14
updated: 2026-06-14
---

**Decision:** Presentation rules in the report layer (refine [[ui-lithuanian-and-curation-layer]]):

1. **Identity numbers.** The "Sklypo apžvalga" header shows both `Kadastrinis Nr.` and `Unikalus Nr.` (parcel "unikalus daikto numeris"). Parcel unique number comes from the `biip-boundary` item's `uniqueNumber`, surfaced via `findParcelUniqueNumber` in `report-format.ts`; hidden when noise/absent. Building list (`grpk-buildings`) shows `Unikalus Nr.` right after `Užstatytas plotas` — best-effort from OSP `pastatai_geo` (`uniqueNumber`, often "N/A" since that dataset is sparse).
2. **Unique-number formatting.** Displayed grouped with dashes: `440047566034` → `4400-4756-6034` via `formatUniqueNumber` (frontend-only; backend value stays raw). Applied to the parcel number and any field marked `isUniqueNumber: true` in FIELD_RULES.
3. **Paskirtis source.** Summary "Paskirtis" is derived from **"Naudojimo būdas"** (`boundary.landUse`) first, falling back to `landPurpose` only when missing.
4. **Šaltinis visibility.** `Šaltinis:` line is shown **only inside an expanded panel** (`<details>` body). Empty/unavailable panels render a quiet one-liner with **no source**.
5. **Google Maps link.** Header (right side) has a "Žemėlapyje (Google)" link built from the parcel centre (`parcelCenter` → `maps/search/?api=1&query=lat,lng`); shown only when geometry is known.
6. **Flags jump to detail.** Summary flags (Saugomos teritorijos, Kultūros paveldas, Taršos rizika, Specialiosios sąlygos) are buttons carrying a `panelKey`; clicking calls `revealPanel` which opens (`<details>.open`) and `scrollIntoView`s `#panel-${key}` (ids added in `ReportPanel.tsx`, `scroll-mt-24`).
7. **Vidutinė rinkos vertė — IMPLEMENTED via RC masinis vertinimas.** Real per-object value scraped from `registrucentras.lt/masvert/paieska-obj` — see [[rc-masvert-market-value]]. Surfaced as the 4th summary fact ("Vidutinė rinkos vertė", after Pastatai sklype) + a `rc-masvert` detail panel (Daikto vertė / Vertinimo data / Pastaba). No value found → no fact (never fabricated).

**Why:** User feedback (2026-06-14).

**How to apply:** Field provenance + LT labels + formatters in `apps/web/src/lib/report-format.ts`; rendering in `apps/web/src/components/{SummaryCard,ReportPanel}.tsx`. Building unique number depends on server: `OspBuildingPoint.uniqueNumber` (osp-service.ts) → grpk item `uniqueBuildingNo` (connectors.ts); `pastatai_geo` field name unconfirmed (probes `unikalus_numeris ?? unikalus_nr`).
