---
name: ux-goal-elderly-readability
description: Core UX goal — full redesign: modern, comfortable, readable map+report for elderly users; visual theme = land & buildings
keywords: ux, ui, map, report, readability, elderly, senyvi, accessibility, organization, design-goal, redesign, modern, theme, land, buildings, zeme, pastatai
created: 2026-06-01
updated: 2026-06-14
---

**Goal:** Full **redesign** of the product UI. It must feel **modern** yet **comfortable for older/elderly people** (senyvo amžiaus žmonės). The current map + information display is scattered, hard to read, and disorganized — it shows both excessive AND missing information. The visual **theme is "the land and buildings"** (žemė ir pastatai) — fitting for this real-estate/parcel product.

**Why:** Stated directly by the user as the primary UX direction for this project. The target audience (elderly) raises the bar on clarity, legibility, and information hierarchy — defaults that work for younger/technical users are insufficient. The land+buildings theme ties the look-and-feel to the domain.

**How to apply:** When building or reviewing any UI (map, ReportPanel, layout, components):
- Prioritize clear information hierarchy and grouping over density.
- Show only relevant info; remove clutter, fill genuine gaps. Avoid "everything at once" dumps.
- Favor large legible type, high contrast, generous spacing, obvious affordances.
- Reduce cognitive load — progressive disclosure over walls of data.
- Carry a modern but warm, grounded aesthetic around the land/buildings theme (earthy tones, parcel/terrain motifs) — not sterile or trendy at the cost of legibility.
- Follow [[redesign-approach]] for methodology (SOLID + ui-ux-pro-max + codebase MCP).
- Pair with [[agent-memory-workflow]]; relates to the ReportPanel and map rendering work.
