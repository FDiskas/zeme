---
name: rc-masvert-market-value
description: How market value (vidutinė rinkos vertė) is fetched by scraping RC masinis vertinimas
keywords: [vidutinė rinkos vertė, market value, masvert, registrucentras, masinis vertinimas, csrf, scraping, unikalus numeris, daikto vertė]
created: 2026-06-14
updated: 2026-10-25
---

**Fact / Rule:** Per-object market value comes from Registrų centras mass valuation, scraped (no JSON API) in `apps/server/src/services/masvert-service.ts`:
1. `GET https://www.registrucentras.lt/masvert/paieska-obj` → extract CSRF from hidden input `name="_csrf" value="…"` and capture the session cookie (`getSetCookie()`). It's a Spring form.
2. `POST` same URL, `application/x-www-form-urlencoded`, body `paieska=1&unikalusNr=<DASHED>&stvGalioja=G&_csrf=<token>`, resending the cookie + a browser User-Agent.
3. Parse the result HTML table scoped between `id="objektoForma"` and `id="anketosForma"`: `Daikto vertė: <strong>14100 Eur</strong>`, `Vertinimo data: <strong>YYYY-MM-DD</strong>`, optional `Pastaba: …`.

`unikalusNr` MUST be the dashed 12-digit form `4400-4756-6034` (use `formatUniqueNumber` from osp-service). Verified live 2026-06-14: 4400-4756-6034 → 14100 €, 2026-01-01.

**Why:** User supplied the exact form mechanism; this is the only known per-parcel value source (open APIs carry none). Replaces the earlier "not available" conclusion.

**How to apply:** `getMarketValuePanel(uniqueNrFormatted)` runs inside the `buildComprehensiveReport` Promise.all and yields the `rc-masvert` panel; any failure → empty panel (honest, never fabricated — see [[no-fabricated-address-or-geometry]]). Display rules in [[report-display-rules]]. Scraping is fragile: if the value disappears, first re-check the page's form field names, CSRF input, and the two `<form id=…>` boundary markers. Cached for the report's lifetime (~6 months); RC revalues yearly (Vertinimo data 01-01).

**Outage behavior (2026-10-25):** RC sometimes takes masvert offline (e.g. Oct 2026, over a PHP vulnerability). During that, the URL returns a *maintenance page with HTTP 200* ("Vyksta sistemos atnaujinimo darbai"), with no `_csrf`, so the scraper returns null. A failed lookup → panel `status: "error"`. In `router.ts`, `refreshMissingMarketValue` re-fetches only this panel for cached reports with no value and saves it with the original `updatedAt` pinned (the field is `@updatedAt`). So the gaps fill in on their own once RC is back. To diagnose "Įrašų nerasta" for the value, first `curl` the masvert page: if it's the maintenance page, the problem is upstream, not ours. A local dev setup can look like it "works" only because the report was cached earlier.
