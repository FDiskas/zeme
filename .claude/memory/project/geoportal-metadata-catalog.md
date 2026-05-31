---
name: geoportal-metadata-catalog
description: geoportal.lt metadata-catalog REST is a dataset DISCOVERY API; surfaces open-data routes around the gated SŽNS gap.
keywords: [geoportal, metadata, catalog, geonetwork, open data, atviri duomenys, SŽNS, apribojimai, reglamentai, TPDR, potvyniai, flood, planavimas, discovery]
created: 2026-06-01
updated: 2026-06-01
---

**Fact / Rule (verified live):** `https://www.geoportal.lt/metadata-catalog/rest/find/group/read` is a GeoNetwork-style **metadata DISCOVERY catalog**, NOT a per-address query API. Returns JSON `{success,total:632,records[].documents[]}`; each document has `uuid`, `name`, `description`, `openData` bool, `extent` bbox, and `actions[]` (the `tag:"open"` action holds the bulk download URL — usually a ZIP/GDB, sometimes an ArcGIS web-app). The `any=` query param did NOT filter in testing (total stayed 632) — treat it as a fetch-all-then-filter-client-side list.

**Why:** The project's biggest data gap is restrictions: SŽNS feature `/query` is gated by Registrų centras (see [[geoportal-data-sources]]). This catalog reveals OPEN alternatives that route around that gate, plus risk layers well-suited to a due-diligence address report.

**How to apply:** Discovery is one-time, not per-address — use it to find a downloadable open dataset, then ingest + spatial-join per parcel (same point/polygon-in-polygon pattern as GRPK in `connectors.ts`). Highest-value openData rinkiniai found:
- **Galiojantys reglamentai (best fill for SŽNS gap):** `https://tpdr.planuojustatau.lt/assets/asgr.gdb.zip` ("Aktualios suvestinės galiojančių reglamentų erdviniai duomenys"). Also TPDR/TPDRIS `*_RIBOS.zip` / `*_SPRENDINIAI.zip` (planning-doc boundaries & solutions).
- **Flood risk/hazard (easy per-parcel flag):** `https://potvyniai.aplinka.lt/duomenys/Potvyniu_*` (rizikos zonos, ribos/mastas, gyliai, altitudes).
- **Other:** Natura 2000 forest restrictions (`VSTT-NATURA-miskai.zip`), soil `Dirv_DR10LT`, melioration/waterlogging `MEL_DR10LT.zip`, demined territories, landfills.
- Caveat: verify each dataset's license/format before ingest — some `open` actions point to an ArcGIS web-app (not a direct ZIP) and at least one flood LiDAR set is `openData=false`.
