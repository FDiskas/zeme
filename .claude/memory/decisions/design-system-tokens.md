---
name: design-system-tokens
description: Web UI design system is Hallmark "Furrow": tokens in apps/web/src/tokens.css (@theme static), Tailwind palette cleared; tangerine is a fill with ink on it, never type
keywords: [design system, tokens, theme, tailwind, palette, furrow, red hat, tangerine, green, ink, paper, hallmark, index.css, chips, notebook card]
updated: 2026-10-26
---

### Rule / Fact

The web UI's colours, faces and type sizes live in [apps/web/src/tokens.css](apps/web/src/tokens.css) (`@theme static`, Tailwind v4). `--color-*: initial` clears Tailwind's palette, so only these exist: `paper` (manila page), `plate` (white sheet), `paper-2` (well/hover), `paper-3` (pressed), `ink`, `ink-2`, `muted`, `rule`, `accent` (tangerine), `accent-soft`, `accent-ink`, `focus`, `green`, `green-soft`, `grid`, `error`, `success`. Faces: `font-display` Red Hat Display 600, `font-body` Red Hat Text 400/500, `font-outlier` Red Hat Mono 500 (cadastral/unique numbers, coordinates only). Sizes: `text-md` = 18px body, `text-sm` = 16px labels. Radii: `rounded-pill` 6px keys, `rounded-card` 10px, `rounded-entry` 14px.

Shared recipes in `@layer components` in [apps/web/src/index.css](apps/web/src/index.css): `.btn` (tangerine moulded primary, ink text), `.btn--secondary` (white key), `.btn--s`, `.btn--icon`, `.link`, `.card`, `.entry` (notebook card: ink ring + lift, ink head band), `.frame`, `.field`, `.code`, `.spec`, `.chip` / `.chip--clear` (green) / `.chip--present` (tangerine), `.cells` (two-column ruled fact cells), `.seg` (segmented keys, pressed = tangerine). `--nav-clear` = top bar height + rule.

The first lines of index.css are the Hallmark stamp (theme, waivers, drops, reviews); `.hallmark/log.json` holds the build log.

### Context & Why

Second full Hallmark redesign on 2026-10-26, replacing Terrazzo (square ink frames, rust). The user wanted it more modern, friendlier and more compact, after sklypoinfo.lt. Furrow (a land/survey theme) was dealt for its legible Red Hat family, soft 6px keys and a green "clear" state. See [[ux-goal-elderly-readability]].

### Practical Impact

- Tangerine is never text colour (it fails contrast): use it as a fill with `text-accent-ink`, or put an ink icon on `accent-soft`. Over the tangerine band, set `[--color-focus:var(--color-ink)]` so the focus ring still reads.
- One filled primary per screen. Status = chip, never colour alone.
- Map polygon colours are CSS classes in index.css (`.map-parcel` + `.map-parcel-casing`, `.map-building`, `.map-neighbor`), with `[data-basemap="ortho"]` variants. They are not Leaflet literals: see [[react-leaflet-classname-prod-only]].
- Home page captures in apps/web/public/screens/ come from the real parcel page (0101/0041:0102). Retake them if the report UI changes. Headless Chrome here closes a page at about 30s, so keep capture waits under 25s.
