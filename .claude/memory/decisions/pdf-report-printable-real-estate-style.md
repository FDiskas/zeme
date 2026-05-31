---
name: pdf-report-printable-real-estate-style
description: PDF output must look like a serious printable real-estate report, not raw data or JSON dumps
keywords:
  [
    pdf,
    report,
    printable,
    real-estate,
    nt,
    layout,
    typography,
    summary,
    professional,
  ]
created: 2026-06-01
updated: 2026-06-01
---

**Decision:** PDF generation must produce a polished, printable real-estate style report rather than a raw data export. Use strong information hierarchy, curated summary sections, clear Lithuanian labels, and print-friendly layout.

**Why:** User explicitly wants PDFs that look like serious NT ataskaitos suitable for printing, not raw JSON / panel dumps. This aligns with the repo's readability and curation goals.

**How to apply:** When changing server-side PDF generation or any export/report view:

- Start with executive summary + property identity, then risks, then detailed sections.
- Prefer readable cards/tables and Lithuanian field labels over generic key dumps.
- Optimize for paper output: A4 sizing, restrained colors, visible sectioning, legal/investment-report tone.
- If new data sources are added, integrate them into the curated report structure instead of appending raw blobs.
