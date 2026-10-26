---
name: orthophoto-basemap
description: Žemėlapis default per visit; Ortofoto = Esri under NŽT ORT10LT (9 survey years via a slider) through the geoportal ArcGIS export endpoint; cached tiles are on an offset grid, unusable as XYZ
keywords: [ortofoto, orthophoto, ORT10LT, geoportal, NŽT, esri, world imagery, basemap, leaflet, tile grid, export, mapproxy, sklypoinfo]
updated: 2026-10-26
---

### Rule / Fact

Every map has a Žemėlapis / Ortofoto switch ([apps/web/src/lib/basemap.ts](apps/web/src/lib/basemap.ts)). With Ortofoto on, a year slider steps through `ORTHO_YEARS`: 1995-2001, 2005-2006, 2009-2010, 2012-2013, 2015, 2018-2020, 2021-2023, 2024-2026 and Naujausia. The choices are kept in **sessionStorage** (`zeme-basemap`, `zeme-ortho-year`), so every new visit opens on Žemėlapis: the user asked that Ortofoto never be the default. Ortofoto mode draws Esri World Imagery with the chosen ORT10LT series over it, from zoom 12 and inside Lithuania's bounds, via `https://www.geoportal.lt/arcgis/rest/services/NZT/<service>/MapServer/export?bbox=…&bboxSR=3857&imageSR=3857&size=256|512,…&format=jpg&f=image`. The services are `ORT10LT_1995_2001` … `ORT10LT_2024_2026` (LKS-94, reprojected by the server) and `ORT10LT_Web_Mercator_102100` for the newest.

### Context & Why

The service's cached tile grid has a non-standard origin (x −20037700, y 33265069) that is offset from web mercator by a fraction of a tile, so `/tile/{z}/{y}/{x}` can never line up with OSM. sklypoinfo.lt uses the same export trick (their `nzt_ort10lt_recent_public` mapproxy path timed out from here). Don't set `crossOrigin` on the layer: geoportal sends no CORS headers, so the images would fail. Geoportal latency varies a lot (0.2s to 45s per image), which is why Esri sits underneath.

### Practical Impact

Attribution must name NŽT/geoportal.lt and Esri, plus the series years when it isn't the newest. It is in the layer attributions and the site footer. On phones the year panel sits on the map's bottom edge, so it doesn't cover the parcel. Over the orthophoto, the neighbour and building lines turn light via `[data-basemap="ortho"]` CSS. Related: [[geoportal-data-sources]], [[competitor-sklypoinfo]].
