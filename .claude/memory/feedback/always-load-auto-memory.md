---
name: always-load-auto-memory
description: Always invoke /auto-memory at the start of every task in this project, no exceptions, even when the task feels urgent.
keywords: [auto-memory, skill, startup, always, no exceptions, protocol]
created: 2026-09-26
updated: 2026-09-26
---

**Rule:** Invoke the `auto-memory` skill at the start of every task in this project — no exceptions, regardless of how urgent, small, or purely-debugging the task appears.

**Why:** Corrected 2026-09-26 after skipping it to jump straight into diagnosing a deploy failure. The user explicitly rejected "it was urgent" as a valid reason to skip it — the instruction is unconditional.

**How to apply:** Treat the SessionStart reminder to load memory as a hard gate before the first substantive action, not a nice-to-have. This applies even to fast bug-fix / firefighting turns where jumping straight to the fix feels natural — load memory first anyway. This is a standing, cross-session rule: it applies at the start of every new conversation in this project going forward, not just the session where it was written.
