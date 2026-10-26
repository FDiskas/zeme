---
name: infostatyba-project-links
description: How a building document links to its public Infostatyba project page (uuid only reachable through the JSF search form by address + project name), via /api/infostatyba with a wait page and caching.
keywords: [infostatyba, projectObjectMain, uuid, jsf, primefaces, viewstate, statybos leidimai, nuoroda, link, scraping, projekto_pavadinimas]
updated: 2026-10-26
---

### Rule / Fact

A permit record's public page is `infostatyba.planuojustatau.lt/eInfostatyba-external/projectObject/projectObjectMain?uuid=<32 hex>`. The uuid is a random UUIDv4 that the OSP open data (infostatyba_duomenys) does not carry, and no URL takes a document number, project number or cadastral number (they answer 500). There is no REST API. The only route is the JSF search form `projectObjectSearch`: GET (JSESSIONID cookie + ViewState), then an ajax POST with **Statinio adresas** (= open-data `adresas`, the same format) + **Projekto pavadinimas** (a prefix of `projekto_pavadinimas`; open-data names are often truncated). Field ids (`j_idt…`) change per deploy, so they are read from the labels. The document-number search (`accounting/accountingISP`) does not lead to project pages.

Implemented in `apps/server/src/services/infostatyba-link.ts`. `GET /api/infostatyba?adresas=&pavadinimas=` returns a cached answer as a 302; otherwise it returns a Lithuanian wait page (`infostatyba-wait-page.ts`) that calls `/api/infostatyba/url` and redirects. The fallback is the search page. On the web, "Dokumento Nr." links to it (FIELD_RULES `externalHref(value, raw)`). OSP permits carry `projectName`.

### Context & Why

The user asked for real links to sources (2026-10-26), for example a permit linking to its Infostatyba project. Resolving uuids during report build would add about 10 s to every report and hit their server for links nobody clicks, so the resolution runs on click.

### Practical Impact

- Timing: the first session GET takes 7–9 s (the page renders the whole register). Each POST takes 1–2.5 s. The session is reused for 10 min and answers are cached 24 h in memory.
- Pick the result row only when it is unique or its title starts with the name prefix. Otherwise send the reader to the search page, never a guess.
- One project page lists many documents and many `projekto_id`s. `projekto_id` is per document or version, not a project key. Rejected applications are missing from public histories.
- Reports cached before 2026-10-26 lack `projectName`. Their links search by address only, which still works when the address has a single project.
