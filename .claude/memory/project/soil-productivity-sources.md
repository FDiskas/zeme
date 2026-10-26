---
name: soil-productivity-sources
description: NŽT soil / našumo balas live MapServers answer point identify, but their licence forbids use in other apps without consent — use the open ZIPs instead.
keywords: [dirvozemis, nasumo balas, soil, productivity, melioracija, NZT, GIS-Centras, Dirv_DR10LT, DIRV_DB10LT, licencija, license]
updated: 2026-10-26
---

### Rule / Fact

`https://www.geoportal.lt/arcgis/rest/services/NZT/Dirv_DR10LT_vertinimas/MapServer` answers `identify` (WGS-84 point, keyless). Layer 0 = per-contour našumo balas with `KLIMATO_K`, `AKMENUOT_K`, `MARGUMO_K`, melioration fields (`TIPAS`, `BUKLE`, `PROJ_NR`), K2O/P2O5/pH; layers 1–4 = average `BALAS` for kadastro vietovė / seniūnija / savivaldybė / LT (ready-made comparison). `NZT/DIRV_DB10LT` gives soil type (LTDK99) and texture (`TEX_*`). Service descriptions say: "Be sutikimo publikuoti duomenis, naudoti servisą kitose aplikacijose draudžiama" (VĮ GIS-Centras).

### Context & Why

Checked while comparing against [[competitor-sklypoinfo]] (their dirvožemis, našumo balas and melioracija sections). The live service would make these an afternoon's work, but the licence text forbids calling it from our app.

### Practical Impact

Do not call these MapServers at request time without written consent from NŽT/GIS-Centras. The open-data route is the catalog ZIPs (`Dirv_DR10LT`, `Dirv_vert_DR10LT`, `MEL_DR10LT`) ingested like `refresh-lkmp-permits.ts` (see [[neighbourhood-data-sources]], [[forest-fish-and-infostatyba-sources]]). Live identify is fine for one-off probing of field meanings.
