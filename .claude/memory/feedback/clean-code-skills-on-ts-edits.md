---
name: clean-code-skills-on-ts-edits
description: Load the TypeScript clean-code skills (typescript-clean-code + boy-scout, clean-tests for tests) before editing .ts/.tsx; a PreToolUse hook reminds once per session.
keywords: [clean code, typescript, skills, boy-scout, clean-tests, hook, ts edits]
updated: 2026-10-30
---

### Rule / Fact

Before editing TypeScript, invoke `typescript-clean-code` and `boy-scout`; add `clean-tests` for test files and `clean-names` / `clean-functions` / `clean-comments` / `clean-general` as the change calls for.

### Context & Why

User asked (2026-10-30) to vendor the skills from github.com/ertugrul-dmr/clean-code-skills (skills/typescript, MIT) into `.claude/skills/` and have them loaded automatically when relevant. Complements [[boy-scout-rule]].

### Practical Impact

`.claude/hooks/ts-clean-code-reminder.sh` (PreToolUse Edit|Write|MultiEdit) injects the reminder on the first .ts/.tsx edit of a session. Keep cleanups proportional to the task; the repo's own conventions win over the book rules when they conflict.
