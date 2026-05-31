---
name: ui-lithuanian-and-curation-layer
description: UI is fully Lithuanian; report uses a curation layer + summary card, not a raw panel dump
keywords: ui, lithuanian, language, curation, summary, report, panels, elderly, ia, decision
created: 2026-06-01
updated: 2026-06-01
---

**Decision:** The web UI is **fully Lithuanian** (audience = elderly Lithuanians). The parcel report must NOT render the raw 12-panel API dump field-by-field. Instead:
- A **curation layer** maps each panel's raw fields → `{ ltLabel, format, priority }`, filters empty/"N/A"/"None"/"0%"/metadata-date/internal-ID fields.
- A derived **Santrauka (summary) card** surfaces the few facts that matter (address, plotas, paskirtis, apribojimai Taip/Ne, pastatai); raw panels are demoted to collapsed "Detali informacija".
- Readability floor for elderly: body ≥18px, labels ≥16px slate-600, values slate-900; drop tiny uppercase grey micro-labels, English status pills, decorative motion.

**Why:** User reported the map+report were "padrikas, sunkiai skaitomas, neorganizuotas", with both excess and missing info. Root cause = no information architecture: [[ux-goal-elderly-readability]]. The 12 panels come from report-service.buildComprehensiveReport; each connector emits flat English camelCase records.

**How to apply:** When touching ReportPanel/ParcelMap/App or adding a new connector panel, add its fields to the curation dictionary (LT label + priority) rather than relying on generic humanizeKey rendering. Never reintroduce raw key dumps or English UI strings.
