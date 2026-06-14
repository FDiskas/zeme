---
name: redesign-approach
description: How to approach the redesign — apply SOLID + ui-ux-pro-max skills, and use codebase MCP to analyze code before changing it
keywords: redesign, approach, methodology, solid, ui-ux-pro-max, codebase, mcp, analysis, skills, workflow
created: 2026-06-14
updated: 2026-06-14
---

**Rule:** For the UI redesign work, the user wants:
- Apply the **`/solid`** skill (SOLID principles, clean code, senior-quality structure) when writing/refactoring code.
- Apply the **`/ui-ux-pro-max`** skill (UI/UX design intelligence — styles, palettes, typography, accessibility) for design decisions.
- Use the **codebase MCP** (`codebase-memory-mcp`: search_code, get_architecture, query_graph, etc.) to analyze the existing codebase before making changes.

**Why:** Explicitly requested as the working method for this redesign. Analyzing the code first (via codebase MCP) avoids guessing at structure; SOLID + ui-ux-pro-max set the quality bar for both code and design.

**How to apply:** Before editing UI code, query the codebase MCP to understand current components/architecture. Then design with ui-ux-pro-max guidance and implement with SOLID. Goal target is in [[ux-goal-elderly-readability]].
