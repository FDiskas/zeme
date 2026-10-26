---
name: ssva-open-data-hub
description: atviri-duomenys-pi-ssva.hub.arcgis.com = SSVA urban stats (26 keyless FeatureServers); per-parcel built-up ratios INTEGRATED as ssva-built-up; block census + green-space access are next candidates; none of soil/melioration/orthophoto/mobile.
keywords: [ssva, arcgis hub, užstatymas, užstatymo tankis, intensyvumas, ADP_SP, PBP_SP, kvartalai, surašymas, želdynai, open data]
updated: 2026-10-26
---

### Rule / Fact

Hub https://atviri-duomenys-pi-ssva.hub.arcgis.com belongs to SSVA (Statybos sektoriaus vystymo agentūra). ArcGIS org `IylpCF7DjNdsT4Zm`, base `https://services-eu1.arcgis.com/IylpCF7DjNdsT4Zm/arcgis/rest/services/`. It has 26 hosted FeatureServers, all anonymous, CC BY 4.0. The hub search API lists only 12 items; use `arcgis.com/sharing/rest/search?q=orgid:IylpCF7DjNdsT4Zm` to see them all.

- **INTEGRATED:** `Pastatų_bendrojo_ploto_ir_sklypo_santykis/FeatureServer/0` → panel `ssva-built-up` (`fetchBuiltUpRatios` in connectors.ts). Fields: `ADP_SP` = % of the parcel under footprints and roofed structures (užstatymo tankis); `PBP_SP` = gross floor area ÷ parcel area (intensyvumas). There is no cadastral number field, so the subject parcel is the feature whose `returnCentroid` point falls inside our outline. Verified: 4174/0300:0850 → 37.6 % / 0.46, close to sklypoinfo's 28 560 m².
- **Candidates, not yet done:** block-level 2021 census (`kvartalai_gyv_2021N`, `Kvartalai_bu_2021`, `Kvartalai_nu_2021`; values below 4 suppressed to 3); green space within 300 m (`Esama_zeldynu_situacija`, `Atskirieji_viesieji_zeldynai_300`); compact vs dispersed built-up land (`Užstatytos_teritorijos_2026_m`, plus a 2021 version for change over time).
- The hub has none of the competitor gaps: soil, našumas, melioration, naudmenys, forest cadastre, orthophoto, general plan, mobile coverage, utilities, noise, tax, legal entities.

### Context & Why

Probed 2026-10-26 while closing gaps against [[competitor-sklypoinfo]]. The metadata says the ratios are indicative (orientacinio pobūdžio), so the UI labels them "≈" and points to the cadastre file for official values.

### Practical Impact

The summary's "Užstatytas plotas" and "Pastatų bendrasis plotas" come from these ratios × the official parcel area. Where the ASGR regulation sets `maxDensityPct` or `maxIntensity`, the allowed amount is shown as a hint under the value. Without SSVA data, the built-up area falls back to GRPK footprints whose centre lies inside the parcel.
