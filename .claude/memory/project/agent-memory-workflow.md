---
name: agent-memory-workflow
description: Use the per-project auto-memory workflow for future tasks in this repository.
keywords: [memory, workflow, auto-memory, preferences, project-context]
created: 2026-05-31
updated: 2026-05-31
---

**Fact / Rule:** This project uses the attached auto-memory workflow under `.claude/memory/`, including `INDEX.md` as the entry point.

**Why:** The user explicitly asked to follow the instructions from the provided `auto-memory` SKILL.md for this repository.

**How to apply:** At the start of tasks, check `.claude/memory/INDEX.md`, load only relevant entries, and save only durable, high-signal facts using the skill's frontmatter and index format.
