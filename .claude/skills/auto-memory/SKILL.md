---
name: auto-memory
description: "Persistent per-project knowledge base. Saves high-signal facts the user marks as important (or that are clearly durable and non-obvious) into topic-organized markdown files under .claude/memory/, and recalls relevant entries when starting a task. Triggers on: remember this, don't forget, save to memory, make a note, important, take note, recall, what do you know about, what do you remember, forget this, update memory, knowledge base. Also activates at the start of tasks touching project context, developer preferences, ongoing work, decisions, incidents, or personal context."
argument-hint: "What should I remember or recall?"
---

# Auto Memory

A per-project, topic-organized knowledge base. Capture only high-value facts that are durable and not obvious from code.

## Scope

- Store memory only in the current project under `.claude/memory/`.
- Never write to global memory from this skill.
- Create `.claude/memory/` only when first save is needed.
- If creation fails due to file system restrictions, report the error and suggest an alternative path.

## Storage Layout

All memory lives under `.claude/memory/`.

```text
.claude/memory/
├── INDEX.md
├── project/
├── developer/
├── feedback/
├── decisions/
└── <other-topic-folders>/
```

Rules:
- Folder names are dynamic, lowercase-kebab-case.
- Reuse existing folders before creating new ones.
- Check `INDEX.md` first to avoid duplicate topic drift.

## When to Save

Always save when user signals explicitly:
- remember this
- don't forget
- save to memory
- make a note
- take note of
- important
- for future reference

Also save when high-signal durable facts are clear without explicit wording:
- Developer profile and durable preferences
- Project context not derivable from code
- Decisions and reasoning
- Incidents, failed attempts, gotchas
- User corrections to approach and rationale
- User-approved non-obvious approaches
- Personal context that should influence collaboration style

Do not save:
- Facts derivable from code, git history, or blame
- Ephemeral task state
- Code snippets and implementation details
- Speculation or low-confidence claims
- Secrets or sensitive data
- Duplicate facts (update existing file instead)

When uncertain, do not save.

## Save Procedure (Two Steps)

### Step 1: Write memory file

Path format:
- `.claude/memory/<topic-folder>/<short-kebab-slug>.md`

Template:

```markdown
---
name: <short-kebab-slug>
description: <one-line summary used for index matching>
keywords: [comma, separated, retrieval, terms]
created: <today-YYYY-MM-DD>
updated: <today-YYYY-MM-DD>
---

**Fact / Rule:** ...

**Why:** ...

**How to apply:** ...

Related: [[other-slug]]
```

Requirements:
- Use the actual current date for `created` and `updated`.
- Keep content concise and actionable.
- Include the reason for decisions/feedback/project context.

### Step 2: Update INDEX.md

- Ensure `.claude/memory/INDEX.md` exists.
- Keep a flat, scannable, folder-grouped index.
- Add or update one-line entries under ~150 chars.

Index format:

```markdown
# Memory Index

## project/
- [architecture-overview](project/architecture-overview.md) — monolith + 2 workers; postgres primary, redis queues. keywords: arch, services, infra

## developer/
- [role-and-background](developer/role-and-background.md) — senior backend (Go), new to frontend. keywords: role, background, skills
```

Rules:
- Every create, update, or delete must update `INDEX.md`.
- Keep summaries terse but keyword-rich for retrieval.

## Retrieval Procedure

Run retrieval at the start of tasks that may benefit from prior context.

1. Check if `.claude/memory/INDEX.md` exists.
2. Read `INDEX.md`.
3. Match request intent against descriptions and keywords.
4. Read only relevant memory files.
5. Apply memories to the task.
6. If memory conflicts with current code reality, trust current code and update or remove stale memory.

For explicit recall requests, read `INDEX.md` and matching files, then answer from those notes.

## Update, Forget, and Prune

- Update in place when new information refines or replaces old facts.
- Always bump `updated` date on edits.
- If summary meaning changes, also update its `INDEX.md` line.
- Forget flow: delete the memory file and remove its `INDEX.md` entry, then confirm deletion.
- Prune stale memory discovered during retrieval.

## Confirmation Behavior

- Explicit save request: save immediately, then report the written path.
- Auto-detected save: save quietly, then mention it in one short line.
- Recall: mention memory usage only when it materially changed the response.

## Decision Points

- Save or skip: is the fact durable, high-signal, and non-derivable from code?
- Create or update: does an existing memory already cover it?
- New folder or existing folder: does current taxonomy already fit?
- Retrieve breadth: which minimal set of files is sufficient?
- Keep or prune: is the memory still accurate against current project reality?

## Completion Checks

A save/update/delete is complete only when all checks pass:
- Target memory file is created/updated/deleted correctly.
- Frontmatter is valid and dates are current.
- `INDEX.md` reflects the change exactly once.
- No sensitive data was stored.
- No duplicate memory entries were introduced.

## Anti-Patterns

- Turning memory into long-form documentation
- Saving code-derived facts instead of referencing source of truth
- Creating redundant topic folders for similar concepts
- Skipping `INDEX.md` maintenance
- Saving decisions without rationale