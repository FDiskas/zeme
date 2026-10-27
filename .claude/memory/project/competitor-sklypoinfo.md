---
name: competitor-sklypoinfo
description: sklypoinfo.lt/report/example = reference competitor report (23 sections); what they have that we lack, and our neighbourhood-data edge.
keywords: [sklypoinfo, competitor, konkurentas, benchmark, ataskaita, naudmenys, dirvozemis, nasumo balas, melioracija, ortofoto, zemes mokestis, mokestine verte, 5G, verslai, JAR]
updated: 2026-10-26
---

### Rule / Fact

https://sklypoinfo.lt/report/example is the benchmark parcel report the user compares reginfo against. Its sections: header facts (perimetras, registravimo data, matavimų tipas, LKS-94 + WGS-84 coords, Google/Apple/Waze links), Bendrasis planas map + legend, statybų dokumentai grouped by stage (pastatyta / darbų pradžia / leidimas / atmesta), SŽNS with legal text per condition, naudmenys breakdown, melioracija (drainage condition), miškų kadastras, saugomos teritorijos, dirvožemis, našumo balas, 3D/KML, istorinės ortofoto (1995→), ESO electricity/gas connection cost calculators, saulės šešėliai, mobilus ryšys + 5G per operator (RRT), daikto + mokestinė vertė, žemės mokesčio skaičiuoklė, pastatai (with energy class), verslai (JAR entities at the address), lyginamoji apžvalga (vs eldership averages). Every section has a "Paaiškinimai" explainer and a plain-language "įžvalga" verdict.

### Context & Why

They lack what we have: crime, schools/health distances, flood risk, census households, pollution sources, KVR heritage, forest-cutting permits, ASGR numeric regulations, fixed broadband. Keep these as our differentiator.

### Practical Impact

When choosing new report features, check this list first. Done 2026-10-26: perimetras, LKS-94/WGS-84 coords, Google/Apple/Waze, statybos dokumentai by stage, per-section įžvalgos, TOC, KML, share, užstatymas (via [[ssva-open-data-hub]]), the Ortofoto map switch ([[orthophoto-basemap]]), the map ruler (MeasureTool) and a 3D key opening the parcel in Google Earth, building energy class ([[energy-certificates-ssva]]) (camera distance scaled to the parcel; no KML/3D of our own); their compact "verdict first, details on demand" sections are the model for the report layout. Soil/našumas/melioracija need ZIP ingest ([[neighbourhood-data-sources]]); SŽNS remains gated ([[geoportal-data-sources]]).
