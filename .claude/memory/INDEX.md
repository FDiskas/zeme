# Memory Index

## project/ ([Topic Index](project/INDEX.md))

- [agent-memory-workflow](project/agent-memory-workflow.md) — use per-project auto-memory workflow in this repo. keywords: memory, workflow, preferences
- [biip-api-scope](project/biip-api-scope.md) — boundaries.biip.lt = boundaries+addresses only; no restrictions/buildings; residential-areas point search gives locality for no-address parcels. keywords: biip, parcels, addresses, rooms, apribojimai, pastatai, geoportal, osp
- [geoportal-data-sources](project/geoportal-data-sources.md) — GRPK building footprints OPEN via ArcGIS REST; SŽNS restrictions gated by RC. keywords: geoportal, GRPK, pastatai, footprints, SŽNS, apribojimai, arcgis
- [geoportal-metadata-catalog](project/geoportal-metadata-catalog.md) — metadata-catalog REST = dataset DISCOVERY (632 records); open-data routes around SŽNS gap (TPDR reglamentai, potvynių zonos). keywords: geoportal, metadata, catalog, open data, SŽNS, reglamentai, TPDR, potvyniai, flood, discovery
- [ux-goal-elderly-readability](project/ux-goal-elderly-readability.md) — full redesign: modern + comfortable for elderly; theme = land & buildings; direction = Hallmark Furrow (2026-10-26); map big + info concise + compact sections, orthophoto toggle. keywords: ux, ui, redesign, modern, theme, land, buildings, readability, elderly, accessibility, design-goal, furrow, compact
- [forest-fish-and-infostatyba-sources](project/forest-fish-and-infostatyba-sources.md) — forest-cutting permits OPEN via lkmp.alisas.lt geometry dump (not data.gov.lt — that misses state forest); fish stocking gated; Infostatyba kadastro_nr padding bug fixed. keywords: miskas, kirtimo leidimai, zuvinimas, infostatyba, kadastro_nr, padding, lkmp, amvmt, biip
- [neighbourhood-data-sources](project/neighbourhood-data-sources.md) — integrated crime/public-order, schools, health, flood, census households, broadband; rejected apartment-deal grid + bad population grids + stale EIIS; noise/soil need ZIP ingest. keywords: nusikalstamumas, crime, mokyklos, darzeliai, gydymo istaigos, triuksmas, potvyniai, overpass
- [orthophoto-basemap](project/orthophoto-basemap.md) — Žemėlapis default per visit; Ortofoto = Esri under NŽT ORT10LT, 9 survey years via slider, geoportal export endpoint (offset tile grid, no CORS). keywords: ortofoto, ORT10LT, geoportal, esri, basemap, leaflet
- [competitor-sklypoinfo](project/competitor-sklypoinfo.md) — sklypoinfo.lt example report = benchmark; their 23 sections vs our neighbourhood edge. keywords: sklypoinfo, competitor, benchmark, features
- [ssva-open-data-hub](project/ssva-open-data-hub.md) — SSVA ArcGIS hub: per-parcel užstatymo tankis/intensyvumas INTEGRATED (ssva-built-up); block census + green access candidates. keywords: ssva, užstatymas, tankis, intensyvumas, kvartalai

## feedback/

- [always-load-auto-memory](feedback/always-load-auto-memory.md) — invoke /auto-memory at start of every task, no exceptions, even when urgent. keywords: auto-memory, skill, startup, always, protocol
- [redesign-approach](feedback/redesign-approach.md) — redesign method: apply /solid + /ui-ux-pro-max skills; use codebase MCP to analyze code first. keywords: redesign, approach, solid, ui-ux-pro-max, codebase, mcp, methodology
- [prefer-simple-cache-repair](feedback/prefer-simple-cache-repair.md) — for pure-cache tables, wipe-and-rebuild beats a targeted verify-and-delete script. keywords: cache, repair, cleanup, simplicity, wipe, rebuild, ParcelReport
- [boy-scout-rule](feedback/boy-scout-rule.md) — always leave touched files cleaner than found (stale comments, misplaced imports, typos, small duplication). keywords: boy scout rule, cleanup, code quality, always

## decisions/ ([Topic Index](decisions/INDEX.md))

- [design-system-tokens](decisions/design-system-tokens.md) — Hallmark Furrow tokens in apps/web/src/tokens.css (@theme static, Tailwind palette cleared); Red Hat Display/Text/Mono, tangerine fill (never text), green chips; recipes .btn/.entry/.cells/.chip/.seg in index.css. keywords: design system, tokens, theme, tailwind, furrow, palette, fonts, colors, chips
- [pdf-report-printable-real-estate-style](decisions/pdf-report-printable-real-estate-style.md) — PDF must be a serious printable NT report, not raw dumps. keywords: pdf, printable, nt, report, layout
- [ui-lithuanian-and-curation-layer](decisions/ui-lithuanian-and-curation-layer.md) — UI fully Lithuanian; report uses curation layer + summary card, not raw panel dump. keywords: ui, lithuanian, curation, summary, report, panels, decision
- [report-display-rules](decisions/report-display-rules.md) — show Unikalus Nr. by cadastral/built-up area; Paskirtis from Naudojimo būdas; Šaltinis only in expanded panels. keywords: report, unikalus numeris, paskirtis, naudojimo būdas, šaltinis, įrašų nerasta, display
- [no-fabricated-address-or-geometry](decisions/no-fabricated-address-or-geometry.md) — never fake address/outline; hasStreetAddress flag; buildFromNominatim cadastral-collision bug FIXED 2026-09-26 + clear-parcel-report-cache script. keywords: address, fabricated, fake, placeholder, hasStreetAddress, geometry, cache poisoning, buildFromNominatim
- [rc-masvert-market-value](decisions/rc-masvert-market-value.md) — market value scraped from RC masinis vertinimas (CSRF GET+POST, HTML parse); RC outage = 200 maintenance page; missing value re-fetched from cache. keywords: vidutinė rinkos vertė, market value, masvert, registrucentras, csrf, scraping, daikto vertė
- [dokploy-deployment](decisions/dokploy-deployment.md) — Confirmed working: Dokploy Compose, reginfo service name, no ports, --ignore-scripts, bunx, scripts/ in context; avoid "latest" pins for typescript/prisma (broke builds twice). keywords: dokploy, deploy, docker, docker-compose, bun, puppeteer, nginx, typescript, latest, openapi-ts
- [autocomplete-biip-address-fallback](decisions/autocomplete-biip-address-fallback.md) — BIIP addressesSearch fallback when Nominatim returns 0 results for Lithuanian address text. keywords: autocomplete, nominatim, biip, address, search, fallback, postal code, street

## gotchas/

- [react-leaflet-classname-prod-only](gotchas/react-leaflet-classname-prod-only.md) — Leaflet className via pathOptions only works in dev (StrictMode); prod shows default blue polygons. Spread as props; verify maps on a prod build. keywords: leaflet, react-leaflet, className, pathOptions, strictmode, production, map colours
