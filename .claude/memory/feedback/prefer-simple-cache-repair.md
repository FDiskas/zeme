---
name: prefer-simple-cache-repair
description: For pure-cache tables (fully re-derivable from upstream registries), prefer wipe-and-rebuild over targeted mismatch-detection repair scripts
keywords: cache, ParcelReport, repair, cleanup, simplicity, wipe, rebuild, ttl, invalidation
created: 2026-09-26
updated: 2026-09-26
---

**Rule:** When asked to clean up corrupted rows in a table that is a pure cache (every field is re-derivable from an upstream source of truth — here, `ParcelReport` rebuilt from BIIP/OSP), don't build a clever per-row verification script (re-querying the registry to check each row and only deleting mismatches). Just delete everything and let it rebuild on next access.

**Why:** User explicitly redirected away from a more sophisticated targeted-repair script ("gal paprasciau tiesiog visus irasus istrint?" — "wouldn't it be simpler to just delete all records?") after being shown a working, network-verified mismatch-detection version. The targeted version adds real cost (per-row API calls, timeouts, throttling logic, risk of subtle false negatives/positives) to save only the recompute cost of rows that were already fine — not worth it for a table that's cheap to rebuild.

**How to apply:** Before writing a "find corrupted rows and fix them" script, check whether the table is pure derived cache vs. a real source of truth. If purely derived: default to a trivial `deleteMany({})` (or per-key delete) script and skip building verification/comparison logic, even if the verification approach is "more correct" in isolation. If the table holds any non-derivable data (user edits, manual overrides), targeted repair is still the right call — this preference is specific to pure cache. Related: [[no-fabricated-address-or-geometry]].
