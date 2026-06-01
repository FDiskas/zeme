import puppeteer from "puppeteer";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ParcelReport } from "@zeme/shared";
import { env } from "../env";

type ReportPanel = ParcelReport["reportPanels"][number];
type Building = NonNullable<ParcelReport["buildings"]>[number];

const FIELD_LABELS: Record<string, string> = {
  cadastralRegNo: "Kadastro Nr.",
  cadastralNumber: "Kadastro Nr.",
  uniqueNumber: "Unikalus Nr.",
  municipality: "Savivaldybė",
  municipalityCode: "Savivaldybės kodas",
  eldership: "Seniūnija",
  areaHectares: "Plotas, ha",
  registeredAreaHa: "Registruotas plotas, ha",
  landPurpose: "Paskirtis",
  landUse: "Naudojimo būdas",
  status: "Būsena",
  updatedAt: "Atnaujinta",
  measuredMethod: "Matavimo būdas",
  address: "Adresas",
  addressesCount: "Adresų sk.",
  buildingsCount: "Pastatų sk.",
  protectedAreaOverlapPercentage: "Saugomų teritorijų dalis",
  protectedAreaNames: "Saugomos teritorijos",
  culturalHeritageOverlapPercentage: "Kultūros paveldo dalis",
  culturalHeritageNames: "Paveldo objektai",
  cadastralDataDate: "Kadastro duomenų data",
  addressDataDate: "Adresų duomenų data",
  protectedAreaKadastroDate: "Saugomų teritorijų data",
  culturalHeritageKadastroDate: "Paveldo duomenų data",
  plotOrBuildingNumber: "Sklypo / pastato Nr.",
  postalCode: "Pašto kodas",
  coordinates: "Koordinatės",
  type: "Tipas",
  roomNumber: "Patalpos Nr.",
  recordNumber: "Įrašo Nr.",
  evaluationDate: "Vertinimo data",
  siteNumber: "Objekto Nr.",
  siteType: "Objekto tipas",
  hazardLevel: "Pavojingumas aplinkai",
  note: "Pastaba",
  areaSqM: "Plotas, kv. m",
  purposeCode: "Paskirties kodas",
  constructionYear: "Statybos metai",
  floors: "Aukštų sk.",
  apartments: "Butų / patalpų sk.",
  source: "Šaltinis",
};

function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function humanizeKey(key: string): string {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];

  return key
    .replaceAll(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replaceAll(/[_-]+/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat("lt-LT", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function formatValue(value: unknown): string {
  if (value == null) return "-";
  if (typeof value === "number") {
    return new Intl.NumberFormat("lt-LT", { maximumFractionDigits: 2 }).format(value);
  }

  if (typeof value === "boolean") return value ? "Taip" : "Ne";
  if (typeof value === "string") {
    if (!value) return "-";
    if (/^\d{4}-\d{2}-\d{2}T/.test(value) || /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return formatDate(value);
    }
    return value;
  }

  if (Array.isArray(value)) {
    const items = value.map((item) => formatValue(item)).filter((item) => item !== "-");
    return items.length > 0 ? items.join(", ") : "-";
  }

  return JSON.stringify(value);
}

function getPanel(report: ParcelReport, key: string): ReportPanel | undefined {
  return report.reportPanels.find((panel) => panel.key === key);
}

function getFirstItem(report: ParcelReport, key: string): Record<string, unknown> | undefined {
  return getPanel(report, key)?.items[0];
}

function getReportMetrics(report: ParcelReport) {
  const boundary = getFirstItem(report, "biip-boundary");
  const ospSummary = getFirstItem(report, "osp-parcel-summary");
  const pollution = getPanel(report, "osp-pollution-risks");
  const restrictions = getPanel(report, "szns-restrictions") ?? getPanel(report, "geoportal-constraints");
  const heritage = getPanel(report, "kvr-heritage");

  return {
    areaHa: boundary?.areaHectares ?? ospSummary?.registeredAreaHa,
    landUse: boundary?.landUse ?? boundary?.landPurpose,
    municipality: boundary?.municipality ?? ospSummary?.municipality,
    eldership: ospSummary?.eldership,
    buildingsCount:
      report.buildings?.length ??
      (typeof ospSummary?.buildingsCount === "number" ? ospSummary.buildingsCount : undefined),
    addressesCount: typeof ospSummary?.addressesCount === "number" ? ospSummary.addressesCount : undefined,
    protectedAreaOverlapPercentage: ospSummary?.protectedAreaOverlapPercentage,
    culturalHeritageOverlapPercentage: ospSummary?.culturalHeritageOverlapPercentage,
    pollutionSites: pollution?.items.length ?? 0,
    restrictionsCount: restrictions?.items.length ?? 0,
    heritageCount: heritage?.items.length ?? 0,
  };
}

function renderSummaryRow(label: string, value: unknown): string {
  const formatted = formatValue(value);
  if (formatted === "-") return "";
  return `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(formatted)}</td></tr>`;
}

function renderSummaryTable(rows: string[]): string {
  const body = rows.filter(Boolean).join("");
  if (!body) return '<p class="empty">Duomenų nepavyko parengti.</p>';
  return `<table class="def-table"><tbody>${body}</tbody></table>`;
}

function renderPanelItems(panel: ReportPanel): string {
  if (panel.items.length === 0) {
    return `<p class="empty">${escapeHtml(panel.note ?? "Duomenų nerasta.")}</p>`;
  }

  return panel.items
    .map((item, index) => {
      const rows = Object.entries(item)
        .map(([key, value]) => renderSummaryRow(humanizeKey(key), value))
        .filter(Boolean)
        .join("");
      if (!rows) return "";
      return `
        <div class="sub-item">
          <p class="sub-label">Įrašas ${index + 1}</p>
          <table class="def-table"><tbody>${rows}</tbody></table>
        </div>
      `;
    })
    .join("");
}

function renderBuildings(buildings: Building[] | undefined): string {
  if (!buildings || buildings.length === 0) {
    return '<p class="empty">Sklype registruotų pastatų duomenų nerasta.</p>';
  }

  return buildings
    .map((building, index) => {
      const title = building.address || `Pastatas ${index + 1}`;
      const rows = [
        renderSummaryRow("Plotas, kv. m", building.areaSqM),
        renderSummaryRow("Paskirties kodas", building.purposeCode),
        renderSummaryRow("Statybos metai", building.constructionYear),
        renderSummaryRow("Aukštų sk.", building.floors),
        renderSummaryRow("Butų / patalpų sk.", building.apartments),
      ].filter(Boolean).join("");
      const table = rows ? `<table class="def-table"><tbody>${rows}</tbody></table>` : "";
      return `<div class="sub-item"><p class="sub-label">${escapeHtml(title)}</p>${table}</div>`;
    })
    .join("");
}

function renderPanel(panel: ReportPanel): string {
  const statusLabel =
    panel.status === "ok"
      ? "Patvirtinta"
      : panel.status === "partial"
        ? "Daliniai duomenys"
        : "Klaida";

  return `
    <div class="panel-block">
      <h3>${escapeHtml(panel.title)}</h3>
      <p class="panel-meta">
        Šaltinis: <em>${escapeHtml(panel.source)}</em> &nbsp;·&nbsp; Būsena: ${escapeHtml(statusLabel)}${panel.note ? ` &nbsp;·&nbsp; ${escapeHtml(panel.note)}` : ""}
      </p>
      ${renderPanelItems(panel)}
    </div>
  `;
}

function buildReportHtml(report: ParcelReport): string {
  const metrics = getReportMetrics(report);
  const generatedAt = formatDate(report.fetchedAt);
  const statusCounts = report.reportPanels.reduce(
    (accumulator, panel) => {
      accumulator[panel.status] += 1;
      return accumulator;
    },
    { ok: 0, partial: 0, error: 0 },
  );

  const summaryTable = renderSummaryTable([
    renderSummaryRow("Plotas", metrics.areaHa != null ? `${formatValue(metrics.areaHa)} ha` : null),
    renderSummaryRow("Naudojimo būdas", metrics.landUse),
    renderSummaryRow("Savivaldybė", metrics.municipality),
    renderSummaryRow("Seniūnija", metrics.eldership),
    renderSummaryRow("Pastatai sklype", metrics.buildingsCount),
    renderSummaryRow("Registruoti adresai", metrics.addressesCount),
    renderSummaryRow("Saugomų teritorijų dalis", metrics.protectedAreaOverlapPercentage),
    renderSummaryRow("Kultūros paveldo dalis", metrics.culturalHeritageOverlapPercentage),
  ]);

  const riskTable = renderSummaryTable([
    renderSummaryRow("Apribojimų įrašų skaičius", metrics.restrictionsCount),
    renderSummaryRow("Paveldo įrašų skaičius", metrics.heritageCount),
    renderSummaryRow("Taršos rizikos objektai", metrics.pollutionSites),
    renderSummaryRow("Patvirtintų duomenų šaltiniai", statusCounts.ok),
    renderSummaryRow("Dalinių duomenų šaltiniai", statusCounts.partial),
    renderSummaryRow("Klaidos arba spragos", statusCounts.error),
  ]);

  return `
    <!DOCTYPE html>
    <html lang="lt">
      <head>
        <meta charset="utf-8" />
        <title>Nekilnojamojo turto ataskaita – ${escapeHtml(report.cadastralRegNo)}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          html, body {
            font-family: "Georgia", "Times New Roman", serif;
            font-size: 11pt;
            color: #111;
            background: #fff;
            line-height: 1.5;
          }

          .page {
            padding: 18mm 20mm;
            max-width: 210mm;
            margin: 0 auto;
          }

          /* ── Document header ─────────────────────────── */
          .doc-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            padding-bottom: 8px;
            border-bottom: 2px solid #111;
            margin-bottom: 18px;
          }

          .doc-header__brand {
            font-size: 10pt;
            font-weight: bold;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }

          .doc-header__meta {
            font-size: 9pt;
            color: #111;
            text-align: right;
            line-height: 1.4;
          }

          /* ── Title block ─────────────────────────────── */
          .doc-title {
            margin-bottom: 20px;
            padding-bottom: 14px;
            border-bottom: 1px solid #ccc;
          }

          .doc-title h1 {
            font-size: 18pt;
            font-weight: bold;
            line-height: 1.15;
            margin-bottom: 8px;
          }

          .doc-title__address {
            font-size: 11pt;
            margin-bottom: 3px;
          }

          .doc-title__cadastral {
            font-size: 9pt;
            color: #111;
          }

          /* ── Section ─────────────────────────────────── */
          .doc-section {
            margin-top: 24px;
            page-break-inside: avoid;
          }

          .doc-section h2 {
            font-size: 11pt;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            border-bottom: 1px solid #111;
            padding-bottom: 4px;
            margin-bottom: 10px;
          }

          /* ── Definition table ────────────────────────── */
          .def-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10pt;
          }

          .def-table th,
          .def-table td {
            text-align: left;
            vertical-align: top;
            padding: 5px 8px 5px 0;
            border-bottom: 1px solid #ddd;
          }

          .def-table th {
            width: 42%;
            color: #111;
            font-weight: normal;
            padding-right: 16px;
          }

          /* ── Panel blocks ────────────────────────────── */
          .panels-wrapper {
            margin-top: 6px;
          }

          .panel-block {
            margin-top: 18px;
            page-break-inside: avoid;
          }

          .panel-block h3 {
            font-size: 10.5pt;
            font-weight: bold;
            border-bottom: 1px solid #bbb;
            padding-bottom: 3px;
            margin-bottom: 5px;
          }

          p.panel-meta {
            font-size: 8.5pt;
            color: #111;
            margin-bottom: 8px;
          }

          /* ── Sub-items ───────────────────────────────── */
          .sub-item {
            margin-top: 8px;
          }

          .sub-item + .sub-item {
            border-top: 1px dashed #ccc;
            padding-top: 8px;
          }

          p.sub-label {
            font-size: 8.5pt;
            font-style: italic;
            color: #111;
            margin-bottom: 3px;
          }

          /* ── Empty ───────────────────────────────────── */
          p.empty {
            font-size: 10pt;
            color: #111;
            font-style: italic;
          }

          /* ── Footer ──────────────────────────────────── */
          .doc-footer {
            margin-top: 32px;
            padding-top: 8px;
            border-top: 1px solid #bbb;
            display: flex;
            justify-content: space-between;
            font-size: 8pt;
            color: #111;
          }

          .doc-footer__note {
            max-width: 80%;
          }

          /* ── Print ───────────────────────────────────── */
          @page {
            size: A4;
            margin: 18mm 20mm;
          }

          @media screen {
            body { background: #e8e8e8; }
            .page {
              background: #fff;
              box-shadow: 0 2px 16px rgba(0,0,0,0.12);
              min-height: 297mm;
            }
          }

          @media print {
            body { background: #fff; }
            .page { padding: 0; max-width: none; }
          }
        </style>
      </head>
      <body>
        <div class="page">
          <header class="doc-header">
            <span class="doc-header__brand">reginfo.lt</span>
            <span class="doc-header__meta">
              Sugeneruota: ${escapeHtml(generatedAt)}<br>
              Duomenų šaltiniai: ${escapeHtml(String(report.sources.length))} db.
            </span>
          </header>

          <div class="doc-title">
            <h1>Nekilnojamojo turto patikros ataskaita</h1>
            <p class="doc-title__address">${escapeHtml(report.address)}</p>
            <p class="doc-title__cadastral">Kadastro Nr.: ${escapeHtml(report.cadastralRegNo)}</p>
          </div>

          <section class="doc-section">
            <h2>Pagrindiniai duomenys</h2>
            ${summaryTable}
          </section>

          <section class="doc-section">
            <h2>Apribojimų ir rizikų suvestinė</h2>
            ${riskTable}
          </section>

          ${report.buildings && report.buildings.length > 0 ? `
          <section class="doc-section">
            <h2>Pastatai sklype</h2>
            ${renderBuildings(report.buildings)}
          </section>
          ` : ""}

          <section class="doc-section">
            <h2>Detalūs šaltinių duomenys</h2>
            <div class="panels-wrapper">
              ${report.reportPanels.map((panel) => renderPanel(panel)).join("")}
            </div>
          </section>

          <footer class="doc-footer">
            <span class="doc-footer__note">Ši ataskaita sudaryta automatiškai iš viešų registrų ir geoduomenų šaltinių (reginfo.lt). Prieš priimant teisinius ar investicinius sprendimus rekomenduojama patikrinti oficialius registrus.</span>
            <span>reginfo.lt</span>
          </footer>
        </div>
      </body>
    </html>
  `;
}

export async function renderReportPdf(report: ParcelReport): Promise<string | undefined> {
  // Keep local development fast: if Chromium is unavailable, the app still returns JSON.
  if (env.DISABLE_PDF) {
    return undefined;
  }

  const outDir = join(process.cwd(), "generated", "pdf");
  await mkdir(outDir, { recursive: true });

  const safeId = report.cadastralRegNo.replace(/[^a-zA-Z0-9-_.]/g, "_");
  const output = join(outDir, `${safeId}.pdf`);

  try {
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    try {
      const page = await browser.newPage();
      const html = buildReportHtml(report);

      await page.setContent(html, { waitUntil: "domcontentloaded" });
      const bytes = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
      await writeFile(output, bytes);

      return output;
    } finally {
      await browser.close();
    }
  } catch (err) {
    console.error("Puppeteer PDF generation failed, skipping PDF creation:", err);
    return undefined;
  }
}
