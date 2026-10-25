---
name: neighbourhood-data-sources
description: Open neighbourhood sources; crime grids, schools/kindergartens, health, flood-risk INTEGRATED (neighbourhood-service.ts); population, apartment deals, broadband, noise, soil not yet.
keywords: [nusikalstamumas, crime, mokyklos, darzeliai, schools, gydymo istaigos, gyventojai, sandoriai, internetas, triuksmas, potvyniai, dirvozemis, overpass, osm, ird, nvzr]
updated: 2026-10-25
---

### Rule / Fact

Verified live 2026-10-25 (keyless ArcGIS REST unless noted, all accept `geometry=lon,lat&inSR=4326` point queries):

- **Crime per grid cell — IRD NVZR:** `https://maps.ird.lt/server/rest/services/NVZRGIS/Gardeles/FeatureServer/{0..6}` = GRID100/250/500/1000/2500/5000/10000. Fields `METAI`, `PERIOD` (`I`/`II` half-year, `M` whole year), `VISI` (all crimes), `VAG` (thefts), `NSG` (crimes against health/life). Data 2010 → 2026 I. Use `/arcgis/` path → broken web adaptor; `/server/` works. `NVZRGIS/STATISTIKA_MVW` (municipal `NV_100K`) exists but is stale (ends 2015) — don't use. Administrative offences grid: `ANRGIS/Gardeles`. Traffic accidents: `EIIS/EIIS` MapServer + geoportal ZIP `Policija/EIIS_duomenys.zip`.
- **Education institutions — IRD:** `NVZRGIS/UGDYMOISTAIGOS/FeatureServer/0` — schools AND kindergartens (`PAGRINDINIS_TIPAS` incl. "Ikimokyklinio ugdymo mokykla"), with address. Alternative: OSP `mokyklos_patalpa_geo` (schools only, filter `mokslo_metai='2025-2026'` → 1069 rows; the current school year 2026-2027 is only partially loaded, about 150 rows).
- **OSP (`osp-sdg.stat.gov.lt/arcgis/rest/services`):** `Hosted/Gydymo_įstaigos` (health facilities, points), `grid250_asmenys_geo` (population by 250 m grid + age group), `butu_pirkimas_gardelese_geo` (apartment purchases per grid: count, mean/percentile price, area; latest period ends 2025-01-01, sparse per cell), `sporto_vietos_union_geo`, `maudyklos_geo`, `kapines_union_geo`. `svieslente_*_100k_geo` is municipality-level only, small counts — NOT general crime.
- **Broadband:** get.data.gov.lt `datasets/gov/rrt/interneto_technologiju_rusys_pastatuose/InternetTechPastatas` — technology per (hashed) building, located only by 1 km `grid_id`.
- **Flood risk (INTEGRATED, panel `flood-risk`):** `services-eu1.arcgis.com/1cGVU2oTHcyk0zN5/arcgis/rest/services/Rizika/FeatureServer` layer 0 = river, 1 = coastal economic-risk 100 m grid; 2/9 = residents 1 km grid. Field semantics UNDOCUMENTED (`tikimybe01` alias "gridcode" is an id, not a value) → only report overlap, never probabilities. Pure flood extents exist only as tiles.arcgis.com tile MapServers (no query) or the 219 MB `Potvyniu_ribos` ZIP. `Rizikos_upės/ežerai/jūros_2023` on the same org are water-body pollution risk, NOT floods.
- **Bulk ZIP downloads (geoportal catalog, openData=true):** strategic noise maps `NVSC/nvsc_triuksmas.zip`, road/rail noise outside agglomerations (`LAKD_keliu_triuksmas.zip`, `LTSA_gelezinkeliu_triuksmas.zip`), flood zones `potvyniai.aplinka.lt/duomenys/Potvyniu_*_01_1_10proc.zip`, soil `Dirv_DR10LT`, `Dirv_vert_DR10LT`, `DirvAgroch_DR10LT`, melioration `MEL_DR10LT.zip`. No live query API for flood (`potvyniai.aplinka.lt/arcgis` → redirects to an Experience app).
- **Vilnius only:** `atviras.vplanas.lt/arcgis/rest/services` (Juodosios_demes, Parkingas, Gyventoju_skaicius, Zaliasis_Vilnius, …).
- **data.gov.lt HTML pages** return 429/403 to scripts — use `get.data.gov.lt/datasets/gov/<org>/:ns?format(json)` for discovery instead.
- **OSM Overpass** public endpoints returned 502/timeout during probing — do not depend on them at request time; ingest a Geofabrik Lithuania extract instead.

### Context & Why

User wants richer neighbourhood info in the parcel report (distance to school, crime counts, etc.). Probing done once to find what is genuinely open; see [[geoportal-metadata-catalog]] for the catalog method and [[forest-fish-and-infostatyba-sources]] for the ZIP-ingest pattern (separate process + SQLite).

### Practical Impact

Integrated as `apps/server/src/services/neighbourhood-service.ts` → panels `nearby-services`, `crime-stats`, `flood-risk` (category "Aplinka ir kaimynystė"); router backfills them into cached reports. IRD `STATISTIKA_MVW` municipal stats are stale (ends 2015) — crime baseline is the 5×5 km cell avg per km² plus an absolute "<20/year = low" floor. Latest year comes from a max(METAI) statistics query on the 10 km layer (field returned as `MAXYEAR`). Health layer last edited 2022 and mixes in non-care bodies (filtered by name). Population grid and apartment-deal grid fit the same live-query pattern. ZIP sources (noise, soil, flood extents) need an ingest script like `refresh-lkmp-permits.ts`. Crime at 100 m cells has tiny counts — keep 1 km.
