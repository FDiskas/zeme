---
name: forest-fish-and-infostatyba-sources
description: Verified data.gov.lt forest-cutting-permits API (open); BIIP žuvinimas and VMT kadastras.amvmt.lt ArcGIS are gated; Infostatyba kadastro_nr padding bug fixed.
keywords: [miskas, kirtimo leidimai, forest cutting permits, zuvinimas, fish stocking, infostatyba, kadastro_nr, padding, data.gov.lt, spinta, amvmt, biip, uetk]
created: 2026-09-25
updated: 2026-09-25
---

**Fact / Rule (verified live):**

- **Miško kirtimo leidimai (forest-cutting permits) — OPEN, IMPLEMENTED via
  lkmp.alisas.lt geometry, NOT data.gov.lt.** First attempt used the data.gov.lt
  dataset "Leidimų kirsti mišką statistika" (id 2121, `gov/miskai/leidimai/
  Leidimas`, filterable by `kad_sklypo_nr`) — that's real and live, but **misses
  most state-forest cuttings**, because those are addressed by kvartalas/sklypas
  with no cadastral number recorded at all (confirmed: a real, user-verified permit
  — "Atrankinis sanitarinis kirtimas", Parudaminos girininkija, kvartalas 111,
  sklypas "007,013" — had `kadastrinis_nr: null` and simply doesn't exist in the
  `Leidimas` table). The actual authoritative source — the one `atvira.amvmt.lt`
  itself renders from — is a **static daily GeoJSON dump**:
  `https://lkmp.alisas.lt/static/lkmp-data.geojson.zip` (no auth, ~51MB zipped /
  ~200MB uncompressed, one entry, DEFLATE — extracted with a hand-rolled ~20-line
  ZIP local-file-header reader + `node:zlib` `inflateRawSync`, no zip dependency
  needed). ~147k features nationwide. Each feature is `tipas: "biržė"` (state-forest
  cutting stand — usually `kadastrinis_nr: null`, must be matched by real
  polygon-polygon intersection against the parcel outline) or `tipas: "sklypas"`
  (privately-owned, carries `kadastrinis_nr` directly — exact match is enough).
  Properties: `kirtimo_rusis`, `galioja_nuo`/`galioja_iki`, `kertamas_plotas` (ha),
  `vyraujantys_medziai`, `turis`, `girininkija`/`padalinys`, `nuosavybes_forma`,
  `leid_busena` (`ISSUED`/`EXTENDED` observed), `kvartalas`/`sklypas`, `savivaldybe`.
  Stored in SQLite (`ForestCuttingPermit` table, bbox columns indexed) rather than
  held in memory — steady-state request handling only pulls the handful of
  bbox-matching rows per parcel, so RAM stays flat regardless of dataset size.
  Polygon intersection is bbox-prefilter (SQL) + vertex-in-polygon (both
  directions) + segment-intersection fallback (for slivers where no vertex of
  either polygon lands inside the other) — done in JS only against those few
  candidate rows. Wired as `findForestCuttingPermits` (`lkmp-service.ts`) →
  `fetchForestCuttingPermits` (`connectors.ts`, takes `geometry` not just
  `cadastralRegNo`) → panel key `forest-cutting-permits`. Verified live on
  cadastral parcel `4137/0200:0426` (found all 3 real permits, matching the
  user's own smalsuolis-style screenshot exactly, including a
  `kadastrinis_nr: null` state-forest one).
- **Ingestion runs as a separate OS process, not in-process.** A naive
  `JSON.parse()` of the whole ~200MB document peaks around 5GB RSS (measured
  live); even a fully streamed pipeline (`stream-json`/`stream-chain`, one
  DB-insert chunk at a time — see `scripts/refresh-lkmp-permits.ts`) still peaks
  around 2-2.2GB, because decompression + SAX tokenizing 147k nested-geometry
  features is just an inherently large one-time working set — and JS allocators
  don't hand freed pages back to the OS, so that peak becomes a **permanent
  floor** for the rest of the process's life if done in-process. Fix:
  `lkmp-service.ts`'s `ensureFresh()` spawns `scripts/refresh-lkmp-permits.ts` via
  `Bun.spawn` as its own process instead of importing/calling it — confirmed live
  that the long-running server's RSS stays flat (~125-140MB) throughout a full
  ~43s refresh while the child process alone carries the multi-GB spike, fully
  reclaimed by the OS when it exits. `stream-json`+`stream-chain` gotcha: a chain
  whose final stage returns `none` for every value (nothing reads the output
  side) needs an explicit no-op `.on("data", () => {})` listener or the readable
  half never leaves paused mode and `'end'` never fires — silent deadlock
  otherwise.
- **Įžuvinimai (fish stocking) — GATED, NOT integrated.** `zuvinimas.biip.lt/api`
  (Moleculer backend, same publishing org as `boundaries.biip.lt`) — both
  `/fishStockings` and `/fishStockings/public` return `401 UnauthorizedError/
  INVALID_TOKEN`. The only open data.gov.lt resource ("Žuvų ir vėžių įveisimo
  metinė ataskaita", dataset id 1336) is three **static annual XLSX files
  (2020-2022)**, national aggregate, already stale — not per-water-body, not
  usable for a per-parcel panel. Side find: `uetk.biip.lt/api/objects/search`
  (Upių, ežerų ir tvenkinių kadastras — rivers/lakes/ponds cadastre) IS open/keyless
  and returns real water-body polygons (WKB `geom` field) with `cadastralId`/`name`/
  `category`/`municipality` — useful if a "nearby water body" panel is ever wanted,
  but it carries no stocking data itself. Do not re-probe these — re-check only if
  building this feature is revisited.
- **Infostatyba `kadastro_nr` padding bug — FIXED.** The OSP ArcGIS proxy
  (`osp-sdg.stat.gov.lt/arcgis/rest/services/infostatyba_duomenys/FeatureServer`,
  already wired as `fetchOspBuildingPermits` in `osp-service.ts`) stores the plot
  segment of `kadastro_nr` **inconsistently padded** — most records at natural width
  ("4177/0100:369"), some zero-padded to 4 digits ("4400/0001:0094"). The exact-match
  `where` clause only ever queried the zero-padded form (matching our own
  `normalizeCadastralRegNo`), silently missing real permits whenever a parcel's plot
  number needed padding to reach 4 digits — confirmed live: `4177/0100:0369` returned
  0 rows, `4177/0100:369` returned 9 real permits for the same parcel. Fixed by
  `unpaddedCadastralVariant()` in `osp-service.ts`, which OR's in the unpadded
  variant whenever padding actually changed the string.
- The `get.data.gov.lt` API (spinta framework) supports `?field=value` filters
  (quote string values) and `limit()`/`select()`, but bulk-listing a table with no
  filter can be enormous — the sibling Infostatyba `Statinys` dataset is 330MB+ with
  no filter applied. Always filter server-side; never bulk-sync when a live filtered
  query already works.

**Why:** The user asked to adopt smalsuolis.lt's forest-cutting-permits and
fish-stocking features. Two rounds of live-endpoint probing were needed because the
obvious candidate (VMT's own ArcGIS map) turned out gated, while the real open route
was a differently-named dataset on the general data.gov.lt catalog. See
[[geoportal-data-sources]] and [[geoportal-metadata-catalog]] for the same
discovery method applied to SŽNS/ASGR/GRPK.

**How to apply:** Don't re-derive the `kad_sklypo_nr` encoding or re-probe
`kadastras.amvmt.lt`/`zuvinimas.biip.lt` from scratch — start from the verified
facts above. If fish-stocking is revisited, `uetk.biip.lt` is the water-body
geometry starting point, not `zuvinimas.biip.lt`.
