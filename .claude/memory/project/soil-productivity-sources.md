---
name: soil-productivity-sources
description: Soil, našumo balas and melioration = open FileGDB ZIPs (CC BY 4.0) on geoportal; live NŽT MapServers are licence-barred for app use. Sizes, layers, field meanings, ingest plan.
keywords: [dirvozemis, nasumo balas, soil, productivity, melioracija, melioration, NZT, ZUDC, Dirv_DR10LT, Dirv_vert_DR10LT, MEL_DR10LT, licencija, gdal, geopackage]
updated: 2026-10-26
---

### Rule / Fact

- **Live services are off-limits:** `geoportal.lt/arcgis/rest/services/NZT/Dirv_DR10LT_vertinimas` and `NZT/DIRV_DB10LT` answer `identify`, but their description says "Be sutikimo publikuoti duomenis, naudoti servisą kitose aplikacijose draudžiama" (VĮ GIS-Centras). Use them for one-off probing only.
- **Open ZIPs, all Esri FileGDB in EPSG:3346, same data as the live services (verified at lon 24.10 / lat 55.30, Aristava: BALAS 59.2):**
  - `https://www.geoportal.lt/download/opendata/Dirv_vert_DR10LT/DIRV_vert.zip`: **6.74 GB** (no Content-Length). It holds inner dwg/gdb/shp ZIPs; take only `DIRV_vert_gdb.zip` (1.69 GB). The inner paths use backslashes, so rewrite the separators when extracting. Layer `vertinimas` = 9.48 M farmland polygons, about 110 m² median, `META` 2023-10-31.
    - `BALAS` (−1 = no data), `BAZ_BALAS`, `KLIMATO_K`, `AKMENUOT_K`, `MARGUMO_K`, `AGROCHEM`.
    - `TIPAS`: D = drained by pipes, G = by ditches, N = not drained.
    - `K2O`, `P2O5`, `pH_*`, `SNS_KOM*_T`.
    - `BUKLE` / `PROJ_NR` are empty everywhere.
    - **Ready-made area-weighted averages:** `vietove_kv` (joined by `KOD_VIET` = cadastral number prefix), `vietove_sen`, `vietove_sav` and `vietove_lr` (LT 39.79).
  - `https://www.geoportal.lt/download/opendata/Dirv_DR10LT/Dirv_DR10LT.zip`: 682 MB. Layer `konturas` = 1.54 M polygons.
    - `TEX_K_P/D` (Kačinskis), `TEX_F_P/D` (Fere).
    - `PAVKOMP1-5`: TDV-96; M = forest, i.e. not surveyed.
    - `SNS_KOM*`: LTDK-99 code, e.g. RDg8-k2.
    - **No open code→name table for LTDK-99** was found; we would need to write one.
  - `https://www.geoportal.lt/download/opendata/Mel_DR10LT/MEL_DR10LT.zip`: 77 MB, refreshed yearly.
    - `MELPLOT_P`: drained land, `GKODAS` hm0/hm0p. Its `PLOTAS` is the whole polygon, so intersect it with the parcel.
    - **`BUKLE_P` = drainage condition.** `PAZ_TIP`: DM = waterlogged, DZ = drainage not working, DK = overgrown, DP = turned into bog, DG = sinkholes, DA = forested, DU = built over. `PASIUL`: R = repair, S = reconstruct, N = write off. Also `TIKR_DATA`.
    - `NURAS_P`: drainage written off.
    - `MELPROJ_P`: `MELPROJ_ID`, e.g. P8_1969_Aristava.
- **Licence:** data.gov.lt shows CC BY 4.0 for Dirv_DR10LT (2965) and MEL_DR10LT (2976). The našumo balas set (2966) has **no licence field**: it is likely CC BY 4.0 but unconfirmed; ask info@zudc.lt. Credit line: "VĮ Žemės ūkio duomenų centras / geoportal.lt, CC BY 4.0".

### Context & Why

Checked 2026-10-26 to close the gap against [[competitor-sklypoinfo]] (their dirvožemis, našumo balas, melioracija and lyginamoji sections).

### Practical Impact

- **Ingest:** GDAL (`gdal-bin` in the server image), then `ogr2ogr -f GPKG` with only the needed columns. This gives a separate GeoPackage with an R-tree; Bun's SQLite has the R-tree module. Do not load it into Prisma tables (millions of polygons).
- **Per parcel:** R-tree bbox candidates, then intersection in JS. Output: area-weighted BALAS, drained share, BUKLE_P problems, and comparison with the kadastro vietovė / seniūnija / savivaldybė / LT averages.
- Refresh monthly or less often. The download and pattern are the same as `refresh-lkmp-permits.ts` (see [[forest-fish-and-infostatyba-sources]]).
