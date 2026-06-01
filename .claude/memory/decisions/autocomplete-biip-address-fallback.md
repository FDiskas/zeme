---
name: autocomplete-biip-address-fallback
description: Autocomplete falls back to BIIP addressesSearch when Nominatim returns no results for a Lithuanian address query.
keywords: [autocomplete, nominatim, biip, address, search, fallback, postal code, street]
created: 2026-06-01
updated: 2026-06-01
---

**Fact / Rule:** When Nominatim returns 0 results for a query (e.g. "Žalioji g. 16A, Kalviškių k. LT-14106"), `searchAddressAutocomplete` now falls back to `searchBiipAddressByQuery` in `biip-service.ts`.

**Why:** Nominatim OSM data lacks many Lithuanian residential addresses. BIIP `addressesSearch` supports filtering by postal code, street name (`starts`), and plot/building number — enough to resolve most Lithuanian address formats.

**How to apply:**
- Parse: postal code via `/\bLT-?(\d{5})\b/i`, street name before "g.|pr.|al.|pl.|tv.|skg.", plot number after street abbreviation.
- Filter: `addresses.postal_code.exact` + `addresses.plot_or_building_number.exact` + `streets.name.starts`.
- For each matching address point, call `resolveParcelByCoordinates` to get the parcel, then upsert and return `ParcelSearchItem`.
