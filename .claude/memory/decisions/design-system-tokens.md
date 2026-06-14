---
name: design-system-tokens
description: Web UI design system — Fresh Natural Green tokens live in apps/web/src/index.css @theme; use named scales, never raw hex
keywords: design system, tokens, theme, tailwind, palette, forest, lime, mist, fonts, colors, index.css
created: 2026-06-14
updated: 2026-06-14
---

**Fact / Rule:** The web UI's single source of truth for styling is the Tailwind v4 `@theme` block in [apps/web/src/index.css](apps/web/src/index.css). Components must style via the named token scales, **never raw hex** (the one exception is Leaflet polygon `pathOptions` in ParcelMap, which take literal colors — keep those in sync with the tokens).

Scales (semantic roles):
- **forest** (emerald) = primary action / brand; `forest-700` #047857 is the primary button color.
- **lime** = vivid accent / highlight.
- **mist** = cool neutral surfaces, borders, text; `mist-900` #14201b is body ink, `mist-50` is page surface.
- **amber** = caution flag only (kept distinct from accent).
- Fonts: `font-display` = Space Grotesk (headings), `font-sans` = Inter (body). Also `shadow-soft`/`shadow-lift` and `animate-rise` motion token.

**Why:** Chosen design direction "Fresh Natural Green" (modern, map-forward) for older-user comfort. Centralizing tokens means a palette change happens in one file. See [[ux-goal-elderly-readability]] and [[redesign-approach]].

**How to apply:** When adding/restyling UI, reuse `forest-*`, `lime-*`, `mist-*`, `amber-*`, `font-display`, `shadow-soft`, `animate-rise`. Keep WCAG AA contrast (large type, the audience is elderly). If you must touch map polygon colors, update both the `@theme` token and the literal in ParcelMap.
