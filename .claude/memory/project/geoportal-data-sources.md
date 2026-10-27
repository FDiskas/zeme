---
name: geoportal-data-sources
description: Verified geoportal.lt endpoints for building footprints (open) and SŽNS restrictions (gated).
keywords: [geoportal, GRPK, pastatai, buildings, footprints, SŽNS, apribojimai, restrictions, arcgis, wms, registru-centras]
created: 2026-06-01
updated: 2026-10-27
---

**Merge strategy (implemented):** No shared key between GRPK `GRAKTAS` and OSP `vda_id`. Buildings are merged by **point-in-polygon spatial join**: BIIP address points and OSP `pastatai_geo` points are tested against each GRPK footprint outer ring (ray casting) in EPSG:4326. Footprint gets `address` from the BIIP point inside it (universal) and `floors/apartments/constructionYear` from the OSP point (sparse — only ~4260 managed multi-apartment buildings nationwide, so most parcels get none). OSP points are fetched once (`fetchOspBuildingPoints`) and reused for both the join and the Building Data Bank panel. Verified on parcel 1901/0197:0222.


**Fact / Rule (verified live):**

- **Building footprints (OPEN):** `https://www.geoportal.lt/arcgis/rest/services/NZT/GRPK/MapServer/22/query` (GRPK "Pastatai"). No API key. Spatial intersect works with `geometryType=esriGeometryPolygon`, `inSR=4326`, `outSR=4326` (server reprojects). MUST use `outFields=*` — a field subset triggers HTTP 400 on this legacy ArcGIS 10.31 server. Output is Esri JSON only (`f=geojson` NOT supported); convert rings→GeoJSON client-side. Fields: GKODAS (pa0=building), PASK (purpose code), GRAKTAS, SHAPE_Area (m², in source 3346 units). maxRecordCount=1000. Verified: BIIP parcel 0101/0023:0141 → 31 footprints.
- **ASGR planning regulations (OPEN, live — partial SŽNS-gap fill, IMPLEMENTED):** `https://tpdr.planuojustatau.lt/arcgis/rest/services/duomenu_viesinimas/ASGR/MapServer/0/query` ("Aktuali suvestinė informacija apie galiojančius reglamentus", TPDR / planuojustatau.lt). No key, live spatial intersect via existing `queryArcgisLayer`. Single polygon layer 0. Useful fields: `MAX_AUK_M` (max building height m), `MAX_INTENS`/`MAX_TANKIS` (intensity/density), `MIN_APZELD` (min greenery %), `PAGR_PASK` (purpose), `NAUD_BUD`/`NAUD_TIP`, `FUNKC_ZON`, `APIBENDR` (summary text), `PAGR_PASKD`/`FUNKC_ZOND` (epoch-ms dates). Build-limit fields are populated for detailed-plan zones; general-plan-only zones return them null. Wired via `fetchAsgrRegulations` in `connectors.ts` → panel key `asgr-regulations`. Verified live on a central-Vilnius parcel. The same TPDR ArcGIS host also exposes `ribos`/`sprendiniai`/`sklypai`/`adresai` MapServers under `duomenu_viesinimas`.
- **SŽNS restrictions (PARTLY OPEN, verified 2026-10-27):** `https://www.geoportal.lt/mapproxy/rc_szns/MapServer` (76 layers incl. groups, ~70 condition layers; layer name carries the SŽNS code, e.g. "Elektros AZ (106)"). Proxies RC `SZNS/pub_cache`.
  - `/identify` with `returnGeometry=false` WORKS anonymously, also with `geometryType=esriGeometryPolygon` (whole parcel), `sr=4326`, `layers=all`, `tolerance=0`; layer scale ranges are NOT applied. Fields: `UNIK_NR`, `PAVADINIM` (condition type + law chapter), `OBJECTID_1`, `NUORODA` (RC PDF with the legal conditions, `registrucentras.lt/bylos/dokumentai/szns/<code>.pdf`).
  - `returnGeometry=true` → 401 "Užklausos naudojimas apribotas" (deliberate: no geometry/area). `/query` → 400. `/export` → 500. Do not spoof Referer to get around it.
  - `/tile/{level}/{row}/{col}` = public 512 px PNG32 cache in EPSG:3346, origin (18900, 6258000), levels 0–12 (scale 6M…1:1000). All layers are fused in one image → usable only as a map overlay, not per layer.
  - Full vector data / per-parcel areas still need an RC data agreement: https://www.registrucentras.lt/p/1553 .
- **No OGC WFS** on the public geoportal ArcGIS server — only ArcGIS REST `/query` + WMS image. `maps.registrucentras.lt` exists but was network-unreachable.
- BIIP requests need headers `X-Application-Name: Zeme LT` + `User-Agent` or they 403.

**Why:** The project must draw buildings and show restrictions. GRPK gives the only open building polygons; SŽNS is the authoritative restrictions registry; anonymous identify gives which conditions apply (no geometry/area), the full vectors still need an RC agreement. See [[biip-api-scope]].

**How to apply:** Building footprints flow through `fetchGrpkBuildings` in `connectors.ts` → `report.buildings` → drawn amber on `ParcelMap`. SŽNS INTEGRATED: `fetchSznsRestrictions` sends the parcel outline to `/identify` (POST, one retry on Esri "Error performing identify", which is transient; answers take up to ~8 s) and groups results per SŽNS code → items `{code, name, lawSection, documentUrl, zonesCount, zoneNumbers}`; UI shows the condition, code, zone count and links the law section to the RC PDF, and adds a summary flag. Existing protected-area/heritage constraints still come from OSP (`vstt_stvk`, KVR) and OSP `pastatai_geo` (building attributes, no geometry).
