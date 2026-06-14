# Memory Index

## project/

- [agent-memory-workflow](project/agent-memory-workflow.md) — use per-project auto-memory workflow in this repo. keywords: memory, workflow, preferences
- [biip-api-scope](project/biip-api-scope.md) — boundaries.biip.lt = boundaries+addresses only; no restrictions/buildings; 3 of 21 endpoints used. keywords: biip, parcels, addresses, rooms, apribojimai, pastatai, geoportal, osp
- [geoportal-data-sources](project/geoportal-data-sources.md) — GRPK building footprints OPEN via ArcGIS REST; SŽNS restrictions gated by RC. keywords: geoportal, GRPK, pastatai, footprints, SŽNS, apribojimai, arcgis
- [geoportal-metadata-catalog](project/geoportal-metadata-catalog.md) — metadata-catalog REST = dataset DISCOVERY (632 records); open-data routes around SŽNS gap (TPDR reglamentai, potvynių zonos). keywords: geoportal, metadata, catalog, open data, SŽNS, reglamentai, TPDR, potvyniai, flood, discovery
- [ux-goal-elderly-readability](project/ux-goal-elderly-readability.md) — full redesign: modern + comfortable for elderly; theme = land & buildings; direction = Fresh Natural Green. keywords: ux, ui, redesign, modern, theme, land, buildings, readability, elderly, accessibility, design-goal, green

## feedback/

- [redesign-approach](feedback/redesign-approach.md) — redesign method: apply /solid + /ui-ux-pro-max skills; use codebase MCP to analyze code first. keywords: redesign, approach, solid, ui-ux-pro-max, codebase, mcp, methodology

## decisions/

- [design-system-tokens](decisions/design-system-tokens.md) — Fresh Natural Green tokens in apps/web/src/index.css @theme; forest/lime/mist scales, Space Grotesk+Inter; never raw hex. keywords: design system, tokens, theme, tailwind, palette, fonts, colors
- [pdf-report-printable-real-estate-style](decisions/pdf-report-printable-real-estate-style.md) — PDF must be a serious printable NT report, not raw dumps. keywords: pdf, printable, nt, report, layout
- [ui-lithuanian-and-curation-layer](decisions/ui-lithuanian-and-curation-layer.md) — UI fully Lithuanian; report uses curation layer + summary card, not raw panel dump. keywords: ui, lithuanian, curation, summary, report, panels, decision
- [report-display-rules](decisions/report-display-rules.md) — show Unikalus Nr. by cadastral/built-up area; Paskirtis from Naudojimo būdas; Šaltinis only in expanded panels. keywords: report, unikalus numeris, paskirtis, naudojimo būdas, šaltinis, įrašų nerasta, display
- [no-fabricated-address-or-geometry](decisions/no-fabricated-address-or-geometry.md) — never fake address/outline; show admin area or centre coords; hasStreetAddress flag. keywords: address, fabricated, fake, placeholder, hasStreetAddress, koordinatės, geometry, sklypas be adreso
- [rc-masvert-market-value](decisions/rc-masvert-market-value.md) — market value scraped from RC masinis vertinimas (CSRF GET+POST, HTML parse). keywords: vidutinė rinkos vertė, market value, masvert, registrucentras, csrf, scraping, daikto vertė
- [dokploy-deployment](decisions/dokploy-deployment.md) — Confirmed working: Dokploy Compose, reginfo service name, no ports, --ignore-scripts, bunx, scripts/ in context. keywords: dokploy, deploy, docker, docker-compose, bun, puppeteer, nginx
- [autocomplete-biip-address-fallback](decisions/autocomplete-biip-address-fallback.md) — BIIP addressesSearch fallback when Nominatim returns 0 results for Lithuanian address text. keywords: autocomplete, nominatim, biip, address, search, fallback, postal code, street
