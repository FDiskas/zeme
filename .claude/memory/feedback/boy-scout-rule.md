---
name: boy-scout-rule
description: Always apply the Boy Scout Rule — leave every touched file/area cleaner than found (stale comments, misplaced imports, typos, small duplication).
keywords: [boy scout rule, cleanup, refactor, code quality, always, touched files]
updated: 2026-10-25
---

### Rule / Fact

Always apply the "Boy Scout Rule": in every file/area touched by a task, also fix small nearby problems — stale comments, misplaced imports, typos in user-facing strings, small duplication, dead code.

### Context & Why

Explicit user instruction (2026-10-25, "prašau visada naudoti Boy Scout Rule") given while implementing the neighbourhood panels.

### Practical Impact

Keep cleanups small and in the same area as the change; don't turn them into unrelated large refactors. Mention the cleanups in the final summary so they're visible in review.
