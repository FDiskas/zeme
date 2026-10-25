---
name: biip-api-scope
description: What boundaries.biip.lt API does and does NOT provide for the parcel-info project.
keywords: [biip, boundaries, parcels, addresses, rooms, restrictions, apribojimai, buildings, pastatai, osp, geoportal, residential-areas, gyvenvietė, locality]
created: 2026-05-31
updated: 2026-10-25
---

**Fact / Rule:** `boundaries.biip.lt` is the "National Boundaries and Addresses API of Lithuania" (Registrų centras). It is purely boundaries + addresses. It provides: parcel polygon geometry, cadastral_number, area_ha, unique_number, purpose (+purpose_group, full_name/en), status, updated_at, municipality; address points; rooms (apartments/rooms within a building, point geometry); and admin hierarchy (counties/municipalities/elderships/residential-areas/streets, each with a `/geometry` endpoint). 21 endpoints total. It does NOT contain restrictions/servitudes (apribojimai) or building footprints — addresses are only points, not building polygons.

**Why:** The project's goal is to extract restrictions and draw buildings, but BIIP cannot supply those — so they must come from other sources (Geoportal.lt WMS/WFS, RC NTR, OSM). Knowing this avoids wasted effort searching BIIP for data it doesn't have.

**How to apply:** For parcel boundary/address/purpose use BIIP. For restrictions/buildings, extend the OSP/ArcGIS (`osp-service.ts`) or add Geoportal/OSM sources. Used endpoints: `parcels/search`, `addresses/search`, `elderships/search`, `rooms/search`, `residential-areas/search`; unused high-value ones: the `/geometry` endpoints, and unused parcel fields (`status`, `updated_at`, `purpose.full_name`). `addresses/search` with `intersects`+cursor paging (size≤100) returns ALL address points on a parcel, not just the first. See [[biip-api-scope]] context in `biip-service.ts`.


**Locality for no-address parcels:** `residential-areas/search` with a point `intersects` filter returns the village/town whose territory contains the point — residential-area boundaries tile (almost) the whole country, so even forest parcels get one (verified on forest, village and town points). Names already carry the suffix ("Kalviškių k.", "Rusnės mstl.") and the item includes `municipality.name`. Used by `resolveLocality` → `ParcelReport.locality`.