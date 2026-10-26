---
name: orthophoto-basemap
description: Žemėlapis default per visit; Ortofoto = Esri under NŽT ORT10LT, survey years read LIVE from geoportal's NZT folder by the server (map.orthoSeries, 24h cache, fallback list); export endpoint because cached tiles sit on an offset grid
keywords: [ortofoto, orthophoto, ORT10LT, geoportal, NŽT, esri, world imagery, basemap, leaflet, tile grid, export, mapproxy, sklypoinfo]
updated: 2026-10-26
---

### Rule / Fact

Every map has a Žemėlapis / Ortofoto switch ([apps/web/src/lib/basemap.ts](apps/web/src/lib/basemap.ts)). With Ortofoto on, a year slider steps through the NŽT series. **The list is dynamic:** the server ([apps/server/src/services/ortho-service.ts](apps/server/src/services/ortho-service.ts), RPC `map.orthoSeries`) reads `https://www.geoportal.lt/arcgis/rest/services/NZT?f=json` once a day. It keeps every `ORT10LT_<year>[_<year>]` MapServer, oldest first, and appends `ORT10LT_Web_Mercator_102100` as "Naujausia"; if that service is gone, the newest dated series becomes "Naujausia". On failure it serves the last good list, or `ORTHO_SERIES_FALLBACK` from `@zeme/shared`, which the browser also shows until the live list arrives.

The reader's choice is a service name in **sessionStorage** (`zeme-basemap`, `zeme-ortho-series`). `null` means "follow the newest", and the slider's right end stores null, so a reader on Naujausia moves to new flights automatically. Every new visit opens on Žemėlapis: the user asked that Ortofoto never be the default. Tiles come from `https://www.geoportal.lt/arcgis/rest/services/NZT/<service>/MapServer/export?bbox=…&bboxSR=3857&imageSR=3857&size=256|512,…&format=jpg&f=image`, over Esri World Imagery, from zoom 12 and inside Lithuania's bounds.

### Context & Why

The service's cached tile grid has a non-standard origin (x −20037700, y 33265069) that is offset from web mercator by a fraction of a tile, so `/tile/{z}/{y}/{x}` can never line up with OSM. sklypoinfo.lt uses the same export trick (their `nzt_ort10lt_recent_public` mapproxy path timed out from here). Don't set `crossOrigin` on the tile layer: it isn't needed (nothing reads the pixels), and it would tie the images to geoportal's CORS policy. The REST JSON does send CORS for our origin, but the list goes through the server anyway because geoportal is sometimes very slow. Geoportal latency varies a lot (0.2s to 45s per image), which is why Esri sits underneath.

### Practical Impact

Attribution must name NŽT/geoportal.lt and Esri, plus the series years when it isn't the newest. It is in the layer attributions and the site footer. On phones the year panel sits on the map's bottom edge, so it doesn't cover the parcel. Over the orthophoto, the neighbour and building lines turn light via `[data-basemap="ortho"]` CSS. Related: [[geoportal-data-sources]], [[competitor-sklypoinfo]].
