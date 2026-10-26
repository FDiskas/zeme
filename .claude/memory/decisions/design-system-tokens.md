---
name: design-system-tokens
description: Web UI design system is Hallmark "Furrow": tokens in apps/web/src/tokens.css (@theme static), Tailwind palette cleared; tangerine is a fill with ink on it, never type
keywords: [design system, tokens, theme, tailwind, palette, furrow, red hat, tangerine, green, ink, paper, hallmark, index.css, chips, notebook card]
updated: 2026-10-26
---

### Rule / Fact

The web UI's colours, faces and type sizes live in [apps/web/src/tokens.css](apps/web/src/tokens.css) (`@theme static`, Tailwind v4). `--color-*: initial` clears Tailwind's palette, so only these exist: `paper` (manila page), `plate` (white sheet), `paper-2` (well/hover), `paper-3` (pressed), `ink` (soft near-black, 24 %), `ink-2`, `muted`, `rule`, `edge` (3:1 key outline), `accent` (muted terracotta #ad5437, white type on it), `accent-hover`, `accent-soft`, `accent-ink` (white), `parcel` (bright tangerine, the map's parcel edge and legend only), `focus`, `green`, `green-soft`, `warn`, `warn-soft`, `grid`, `error`, `success`. Faces: `font-display` Red Hat Display 600, `font-body` Red Hat Text 400/500, `font-outlier` Red Hat Mono 500 (cadastral/unique numbers, coordinates only). Sizes: `text-md` = 18px body, `text-sm` = 16px labels. Radii: `rounded-pill` 6px keys, `rounded-card` 10px, `rounded-entry` 14px.

Shared recipes in `@layer components` in [apps/web/src/index.css](apps/web/src/index.css): `.btn` (flat terracotta primary, white text), `.btn--secondary` (flat white key, edge = ink 42% mixed into plate for ≥3:1 contrast, no shadow), `.btn--s`, `.btn--icon`, `.link`, `.card`, `.entry` (notebook card: soft ink-14% edge + shadow-card; no ink head band any more), `.frame`, `.field`, `.code`, `.spec`, `.chip` / `.chip--clear` (green) / `.chip--present` (brick red `warn`), `.cells` (two-column fact cells, rule-coloured hairlines only — an ink rule inside the card read as a crack), `.pill-link` (quiet paper-2 pill, the report's section index), `.tip`/`.tip__bubble` (hover/tap note; `InfoTip` component wraps a label + "i" key), `.spec` (top rule = `edge`, not ink), `.seg` (segmented keys, pressed = paper-2 well + 600 weight, no ring), `.map-zoom` (our own zoom buttons; Leaflet's zoomControl is off). `--nav-clear` = top bar height + rule.

The first lines of index.css are the Hallmark stamp (theme, waivers, drops, reviews); `.hallmark/log.json` holds the build log.

### Context & Why

Second full Hallmark redesign on 2026-10-26, replacing Terrazzo (square ink frames, rust). The user wanted it more modern, friendlier and more compact, after sklypoinfo.lt. Furrow (a land/survey theme) was dealt for its legible Red Hat family, soft 6px keys and a green "clear" state. See [[ux-goal-elderly-readability]].

### Practical Impact

- Calm palette (user review 2026-10-26: "spalvos per kontrastingos", "nepatinka logotipas, pagrindiniai mygtukai"): no ink rules anywhere (header, footer, section heads use `rule`/`edge`), no full-bleed accent bands (the home explore band is `accent-soft`), no inset borders on chips. Terracotta is for brand + the one primary key only, never a risk or a toggle state. Logo = `LogoMark`: a surveyed parcel outline with corner points and a house, token-coloured, no filled square; wordmark "Reginfo" + muted ".lt"; favicon.svg mirrors it. Risk tones: green = fine, `warn` brick red = attention, paper grey = unknown. Use the accent as a fill with `text-accent-ink` (white, 5:1).
- One filled primary per screen. Status = chip, never colour alone.
- Map polygon colours are CSS classes in index.css (`.map-parcel` + `.map-parcel-casing`, `.map-building`, `.map-neighbor`), with `[data-basemap="ortho"]` variants. They are not Leaflet literals: see [[react-leaflet-classname-prod-only]].
- Home page captures in apps/web/public/screens/ come from the real parcel page (0101/0041:0102). Retake them if the report UI changes (hero-card = card down to the first key-fact row; report-flags = checks list, no rule on top; report-detail = opened kvr-heritage panel cut on a row gap, 1056x842; report-ortho-phone = 390px phone from the map top, Ortofoto at 2015, cut under the legend, 780x1080; report-map-phone = the map half of report-page.jpg for the tour's first step on phones; all @2x) and update width/height/ratio in App.tsx + HomeSections.tsx. Crop with a top-anchored tool: macOS `sips -c` ignores `--cropOffset` and crops from the centre. Puppeteer: `node_modules/.bun/puppeteer-core@*/node_modules/puppeteer-core` with system Chrome (hallmark capture.mjs needs `HALLMARK_PUPPETEER` set to that dir). Headless Chrome here closes a page at about 30s: one browser per shot, waits under 25s.
