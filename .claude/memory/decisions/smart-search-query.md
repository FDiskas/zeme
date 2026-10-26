---
name: smart-search-query
description: One search field reads unique/cadastral numbers, addresses, GPS + LKS-94 coordinates and Google Maps links; parser shared in packages/shared; unique numbers can be 11 digits
keywords: [search, paieška, autocomplete, unikalus numeris, 11 digits, kadastro numeris, koordinatės, LKS-94, GPS, google maps, maps.app.goo.gl, parseSearchQuery, examples, 1010-0410-102]
updated: 2026-10-26
---

### Rule / Fact

`parseSearchQuery` in [packages/shared/src/search-query.ts](../../../packages/shared/src/search-query.ts) classifies an entry. The browser (`ParcelSearch.tsx`) uses it to show the recognised kind, and the server (`searchAddressAutocomplete`) uses it to resolve the entry. Kinds: unique (dashed `4-4-3` or `4-4-4`), cadastral, gps, lks (converted to WGS-84 in shared), maps-link (`!3d!4d` pin > `q=` > `@`), maps-short-link (server follows redirects by hand, Google hosts only), link (listings are not read: honest note), and address (Nominatim → BIIP). An exact kind with exactly one hit navigates straight to the parcel. An address lists its matches.

### Context & Why

Registrų centras unique numbers are **11 or 12 digits**: `1010-0410-102` is parcel 0101/0041:0102 (Tilto g. 2A, the home-page example parcel). The old 12-digit-only pattern sent it to the loose cadastral matcher as 1010/0410:0102, which does not exist. An 11-digit dashed entry is therefore tried as a unique number first and as a cadastral number second. Home-page examples use `1010-0410-102` (user's choice, 2026-10-26).

### Practical Impact

- The input schema allows up to 2048 characters (Google links are long).
- Buildings belong to a parcel only when their footprint's centre lies inside it. GRPK's intersects query also returns neighbours' buildings that touch the line. The rule is applied in `fetchGrpkBuildings` (server, new reports) and `buildingsInParcel` (web `geo.ts`: map + card, covers cached reports). Long strip parcels (roads, rivers) legitimately end up with 0 buildings.
- Recently viewed: 5 shown (6 stored so the parcel page still lists 5 without itself), one line each via `shortAddress`, × per row + Išvalyti; hook in `lib/useRecentParcels.ts`.
