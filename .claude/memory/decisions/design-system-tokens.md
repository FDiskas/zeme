---
name: design-system-tokens
description: Web UI design system is Hallmark "Terrazzo" — tokens in apps/web/src/tokens.css (@theme static), Tailwind default palette cleared; never raw colours
keywords: [design system, tokens, theme, tailwind, palette, terrazzo, syne, onest, jetbrains mono, rust, ink, paper, hallmark, index.css]
updated: 2026-10-26
---

### Rule / Fact

The web UI's colours, faces and type sizes live in [apps/web/src/tokens.css](apps/web/src/tokens.css) (`@theme static`, Tailwind v4). `--color-*: initial` clears Tailwind's palette, so only these exist: `paper`, `paper-2`, `paper-3`, `plate`, `ink`, `ink-2`, `muted`, `rule`, `accent` (rust), `accent-soft`, `accent-ink`, `focus`, `error`, `success`. No `white`/`black`/`slate` utilities. Faces: `font-display` Syne 700, `font-body` Onest 400/500, `font-outlier` JetBrains Mono 500 (codes only). Sizes: `text-md` = 18px body, `text-sm` = 16px labels, plus `text-title`, `text-section`, `text-display`, `text-lead`.

Shared recipes are in `@layer components` in [apps/web/src/index.css](apps/web/src/index.css): `.btn` (ink primary), `.btn--secondary` (inset ink outline), `.btn--s`, `.link`, `.card` (plate + 2px ink border + hard 14px offset), `.frame`, `.field`, `.code`, `.spec` (2px ink top rule, hairlines between rows). `container` is redefined via `@utility` (1440 cap, `--gutter`). `--nav-clear` clears the floating nav for sticky panes and anchors.

The first lines of index.css are the Hallmark stamp (theme, waivers, rewordings); `.hallmark/log.json` holds the build log.

### Context & Why

Full Hallmark redesign 2026-10-26: the user chose a new dealt theme over the old emerald "Fresh Natural Green" brand. Terrazzo was picked for older readers (light warm paper, plain Onest body) and for its mono code role, which fits cadastral numbers. See [[ux-goal-elderly-readability]].

### Practical Impact

- Rust is the one signal: cadastral codes, the subject parcel on the map, "present" flags (soft rust row + rust warning icon), focus ring, link hover. Everything else is ink; controls are never coloured.
- Radius 0 everywhere. One filled primary per screen.
- Map polygon colours are CSS classes in index.css (`.map-parcel`, `.map-building`, `.map-neighbor`), not Leaflet literals.
- Home page product shots in apps/web/public/screens/ are captures of the real parcel page (0101/0041:0102); retake them if the report UI changes.
