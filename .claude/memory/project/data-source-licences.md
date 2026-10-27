---
name: data-source-licences
description: Per-source licence facts (checked 2026-10-27) behind the credit lines in data-sources.ts; ORT10LT 2021–2023 forbids app use without consent, KVR CC BY vs "non-commercial", flood sets CC BY-ND, many sources state no licence.
keywords: [licencija, licence, CC BY 4.0, ODbL, attribution, šaltinio nurodymas, ORT10LT, KVR, potvyniai, CC BY-ND, esri, osm, nominatim, data.gov.lt]
updated: 2026-10-27
---

### Rule / Fact

`DATA_SOURCES` in apps/web/src/lib/data-sources.ts carries `access`, `licence` (phrase + url + `statedAt` evidence link), `licenceNote` and `processing`. The /duomenu-saltiniai page builds each credit line from them: "Duomenų šaltinis: X (pasiekiama per API). Duomenys platinami pagal … / Šaltinis licencijos nenurodo. Originalūs duomenys buvo apdoroti…". Only set `licence` where the publisher states it.

- **CC BY 4.0 stated (data.gov.lt id):** ntr_sklypai 2831, BIIP national-boundaries-api (README), GRPK 1302, pen_sertifikatai 2366, vstt_stvk 789, KVR 2192, ASGR 3747, taršos židiniai 1330 (publisher = Lietuvos geologijos tarnyba), census grid 3051, RRT broadband 3835.
- **No licence stated:** OSP osp-sdg layers as such, SSVA built-up item, PDBIS, Infostatyba, SŽNS (metadata: no use restrictions), RC masvert, lkmp forest dump, maps.ird.lt grids/schools, RRT mobile coverage, NŽT ORT10LT.
- **Open problems for the owner:** ORT10LT_2021_2023 service text forbids use in other apps without consent (ask pagalba@geoportal.lt or drop that series). KVR: geoportal metadata says "Tik nekomercinis naudojimas", which conflicts with CC BY 4.0. Flood INSPIRE sets (3641, 3634) are CC BY-ND 4.0. That is why the flood credit says we only test the intersection.
- OSM tiles and Nominatim are ODbL 1.0. Map attribution: "© OpenStreetMap bendraautoriai". Esri World Imagery is under Esri terms, credited "Esri, Vantor, Earthstar Geographics ir GIS User Community".

### Context & Why

The user asked (2026-10-27) for every source to be credited with the template line, alongside the new Apie projektą and Naudojimosi taisyklės pages. A licence research pass found that most endpoints state none. The user wants the credits to be truthful, not boilerplate.

### Practical Impact

When adding a source, find its licence on data.gov.lt or the publisher's page and fill `licence` + `statedAt`. Otherwise leave it out. Never write CC BY 4.0 by default. Gydymo_įstaigos on OSP describes itself as a training layer ("Kartokapibarų praktikos tikslams"), so prefer the VLK list (data.gov.lt 1386) if that source is reworked.
