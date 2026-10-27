---
name: energy-certificates-ssva
description: Energy-performance certificates (klasė A++…G) OPEN on data.gov.lt (ssva/pen_sertifikatai, CC BY 4.0), INTEGRATED as panel energy-certificates; matched by free-text address (no unique nr/coords).
keywords: [energinis naudingumas, energinio naudingumo klase, sertifikatai, energy class, ssva, spsc, pen_sertifikatai, data.gov.lt, pastatai]
updated: 2026-10-27
---

### Rule / Fact

`https://get.data.gov.lt/datasets/gov/ssva/pen_sertifikatai/Sertifikatas` (keyless Spinta API, CC BY 4.0, data.gov.lt dataset 2366) holds 439 545 certificates, newest `isdavimas` 2025-12-31.
- **Fields:** `nr`, `adresas`, `klase`, `plotas` (m²), `sildymas`, `sanaudos`, `co2`, `saltiniai` (heat source), `isdavimas`, `galiojimas`, `pozymis`, and `paskirtis` (ref → `Paskirtis`: GV/KG/… with group GYV/…).
- **Filtering:** `adresas.contains("…")` and `adresas.startswith("…")` work server-side (URL-encode with `curl -G --data-urlencode`).
- **No match key:** `koord` is null in every row, and there is no building unique number.

### Context & Why

The address text is inconsistent: the same building appears as "Galinės 8, Galinės, Vilniaus r. sav." while the registry calls it "Galinės g. 8, Galinės k.". Flats carry "-44" suffixes. sklypoinfo shows the same A+ class for that building, so they match by address too. See [[competitor-sklypoinfo]].

### Practical Impact

INTEGRATED in `apps/server/src/services/energy-certificates.ts` as the panel `energy-certificates`, in the "Pastatai" category, and backfilled into cached reports.
- **Inputs:** the parcel's address points, parsed from the `biip-addresses` panel ("Sav., Gyvenvietė, Gatvė Nr").
- **Query:** one `contains(longest street word) & contains(municipality)` query per street.
- **Matching:** street names (type words and initials dropped), house numbers ("8 B" = "8B") and settlements (first 4 letters, since "Kaunas" = "Kauno m.") are compared client-side.
- **Choice:** the newest whole-building certificate wins; flats (`-N`) are tallied apart.
- **Errors:** data.gov.lt sometimes drops a request in a burst, so the fetch retries once.
- **Hit rate:** about 16 of 25 cached parcels with addresses matched.
- **Wording:** always say "rasta pagal adresą".
