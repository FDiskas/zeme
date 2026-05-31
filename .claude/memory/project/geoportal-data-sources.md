---
name: geoportal-data-sources
description: Verified geoportal.lt endpoints for building footprints (open) and SŽNS restrictions (gated).
keywords: [geoportal, GRPK, pastatai, buildings, footprints, SŽNS, apribojimai, restrictions, arcgis, wms, registru-centras]
created: 2026-06-01
updated: 2026-06-01
---

**Merge strategy (implemented):** No shared key between GRPK `GRAKTAS` and OSP `vda_id`. Buildings are merged by **point-in-polygon spatial join**: BIIP address points and OSP `pastatai_geo` points are tested against each GRPK footprint outer ring (ray casting) in EPSG:4326. Footprint gets `address` from the BIIP point inside it (universal) and `floors/apartments/constructionYear` from the OSP point (sparse — only ~4260 managed multi-apartment buildings nationwide, so most parcels get none). OSP points are fetched once (`fetchOspBuildingPoints`) and reused for both the join and the Building Data Bank panel. Verified on parcel 1901/0197:0222.


**Fact / Rule (verified live):**

- **Building footprints (OPEN):** `https://www.geoportal.lt/arcgis/rest/services/NZT/GRPK/MapServer/22/query` (GRPK "Pastatai"). No API key. Spatial intersect works with `geometryType=esriGeometryPolygon`, `inSR=4326`, `outSR=4326` (server reprojects). MUST use `outFields=*` — a field subset triggers HTTP 400 on this legacy ArcGIS 10.31 server. Output is Esri JSON only (`f=geojson` NOT supported); convert rings→GeoJSON client-side. Fields: GKODAS (pa0=building), PASK (purpose code), GRAKTAS, SHAPE_Area (m², in source 3346 units). maxRecordCount=1000. Verified: BIIP parcel 0101/0023:0141 → 31 footprints.
- **SŽNS restrictions (GATED):** `https://www.geoportal.lt/mapproxy/rc_szns/MapServer` (58 condition layers). Map/image view public, but feature `/query` is NOT exposed publicly — returns Esri error (401 "Užklausos naudojimas apribotas" or 400 "operation not supported"). Cannot extract restriction vectors anonymously. Authorization route: https://www.registrucentras.lt/p/1553 .
- **No OGC WFS** on the public geoportal ArcGIS server — only ArcGIS REST `/query` + WMS image. `maps.registrucentras.lt` exists but was network-unreachable.
- BIIP requests need headers `X-Application-Name: Zeme LT` + `User-Agent` or they 403.

**Why:** The project must draw buildings and show restrictions. GRPK gives the only open building polygons; SŽNS is the authoritative restrictions registry but blocked without an RC agreement — so the report documents the gap instead of faking it. See [[biip-api-scope]].

**How to apply:** Building footprints flow through `fetchGrpkBuildings` in `connectors.ts` → `report.buildings` → drawn amber on `ParcelMap`. SŽNS handled by `fetchSznsRestrictions` (degrades to a "partial" panel with the auth link). Existing protected-area/heritage constraints still come from OSP (`vstt_stvk`, KVR) and OSP `pastatai_geo` (building attributes, no geometry).
