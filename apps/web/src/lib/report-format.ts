import type { ParcelReport } from "@zeme/shared";

// ---------------------------------------------------------------------------
// Curation layer
//
// The server returns 12 raw panels, each a flat record of English machine-named
// fields straight from the upstream registries (many empty / "N/A" / metadata).
// Rendering that verbatim is what made the report "padrika, sunkiai skaitoma".
//
// This module is the single place that decides, for an elderly Lithuanian
// reader: which fields matter, what they are called in Lithuanian, how they are
// grouped, and which few facts deserve to be lifted into a top summary card.
// Nothing here fetches or mutates data — it is purely presentational.
// ---------------------------------------------------------------------------

type RawItem = Record<string, unknown>;

// Panels intentionally kept out of the curated view. Empty by design — the
// fabricated "scraping-fallback" panel was removed at the source. Add a panel
// key here to suppress it without touching render logic.
const HIDDEN_PANEL_KEYS = new Set<string>();

// Values that carry no information for a reader — dropped from every detail row.
const NOISE_VALUES = new Set([
  "",
  "n/a",
  "na",
  "none",
  "nėra",
  "null",
  "undefined",
  "0%",
  "-",
  "—",
]);

// Display formatting for a registry "unikalus daikto numeris": group every 4
// digits with dashes (440047566034 → 4400-4756-6034). The backend value stays
// raw; this only affects how it is shown. Non-numeric values are left unchanged.
export function formatUniqueNumber(value: string): string {
  const trimmed = value.trim();
  if (!/^\d{8,}$/.test(trimmed)) return trimmed;
  return trimmed.replace(/(\d{4})(?=\d)/g, "$1-");
}

export function isNoiseValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return NOISE_VALUES.has(value.trim().toLowerCase());
  return false;
}

type FieldRule = {
  label: string;
  unit?: string;
  isHeading?: boolean; // use this field as the card's heading instead of a row
  isLink?: boolean;
  isUniqueNumber?: boolean; // format as 4400-4756-6034 (grouped registry number)
};

// Per-panel field rules. A field absent from its panel's map is HIDDEN by
// default — so internal IDs, codes, coordinates and *DataDate metadata never
// reach the screen unless we explicitly opted them in. Keys mirror the exact
// field names emitted by apps/server/src/services/{connectors,osp-service}.ts.
const FIELD_RULES: Record<string, Record<string, FieldRule>> = {
  "osp-parcel-summary": {
    registeredAreaHa: { label: "Registruotas plotas", unit: "ha" },
    buildingsCount: { label: "Pastatų skaičius" },
    addressesCount: { label: "Adresų skaičius" },
    eldership: { label: "Seniūnija" },
    municipality: { label: "Savivaldybė" },
    protectedAreaNames: { label: "Saugomos teritorijos" },
    culturalHeritageNames: { label: "Kultūros paveldas" },
  },
  "biip-boundary": {
    municipality: { label: "Savivaldybė" },
    areaHectares: { label: "Sklypo plotas", unit: "ha" },
    landPurpose: { label: "Pagrindinė naudojimo paskirtis" },
    landUse: { label: "Naudojimo būdas" },
    status: { label: "Statusas" },
    updatedAt: { label: "Atnaujinta" },
  },
  "biip-addresses": {
    type: { label: "Tipas", isHeading: true },
    address: { label: "Adresas" },
    plotOrBuildingNumber: { label: "Pastato / sklypo Nr." },
    postalCode: { label: "Pašto kodas" },
    roomNumber: { label: "Patalpos Nr." },
  },
  "grpk-buildings": {
    address: { label: "Adresas", isHeading: true },
    areaSqM: { label: "Užstatytas plotas", unit: "m²" },
    uniqueBuildingNo: { label: "Unikalus Nr.", isUniqueNumber: true },
    floors: { label: "Aukštų skaičius" },
    apartments: { label: "Butų skaičius" },
    constructionYear: { label: "Statybos metai" },
    condition: { label: "Būklė" },
  },
  "pdbis-building-data": {
    address: { label: "Adresas", isHeading: true },
    apartmentsCount: { label: "Butų skaičius" },
    nonResidentialCount: { label: "Negyvenamųjų patalpų" },
    floorsCount: { label: "Aukštų skaičius" },
    buildingAreaSqM: { label: "Pastato plotas", unit: "m²" },
    constructionYear: { label: "Statybos metai" },
    managementForm: { label: "Valdymo forma" },
    managerCategory: { label: "Administratorius" },
    condition: { label: "Būklė" },
    renovationWorks: { label: "Renovacijos darbai" },
  },
  "geoportal-constraints": {
    type: { label: "Tipas", isHeading: true },
    name: { label: "Pavadinimas" },
  },
  "kvr-heritage": {
    type: { label: "Tipas", isHeading: true },
    name: { label: "Pavadinimas" },
    classifier: { label: "Klasifikatorius" },
    status: { label: "Statusas" },
    significance: { label: "Reikšmingumas" },
    address: { label: "Adresas" },
    age: { label: "Amžius" },
    zoneType: { label: "Zonos tipas" },
    link: { label: "Daugiau informacijos", isLink: true },
  },
  "asgr-regulations": {
    summary: { label: "Aprašymas", isHeading: true },
    mainPurpose: { label: "Pagrindinė paskirtis" },
    useMethod: { label: "Naudojimo būdas" },
    useType: { label: "Naudojimo tipas" },
    functionalZone: { label: "Funkcinė zona" },
    maxHeightM: { label: "Didžiausias aukštis", unit: "m" },
    maxIntensity: { label: "Didžiausias užstatymo intensyvumas" },
    maxDensityPct: { label: "Didžiausias užstatymo tankis", unit: "%" },
    minGreeneryPct: { label: "Mažiausias apželdinimas", unit: "%" },
    documentNo: { label: "Dokumento Nr." },
    approvedAt: { label: "Patvirtinta" },
  },
  "szns-restrictions": {
    intersectingConditions: { label: "Galiojančių sąlygų skaičius" },
  },
  "osp-building-permits": {
    permitType: { label: "Dokumento tipas", isHeading: true },
    permitNumber: { label: "Leidimo Nr." },
    issuedDate: { label: "Išdavimo data" },
    status: { label: "Statusas" },
    buildingDescription: { label: "Statinio pavadinimas" },
    buildingPurpose: { label: "Statinio paskirtis" },
    buildingCategory: { label: "Kategorija" },
    constructionType: { label: "Statybos rūšis" },
    address: { label: "Adresas" },
    projectYear: { label: "Projekto metai" },
  },
  "rc-masvert": {
    marketValueEur: { label: "Daikto vertė", unit: "€" },
    valuationDate: { label: "Vertinimo data" },
    note: { label: "Pastaba" },
  },
  "osp-pollution-risks": {
    siteType: { label: "Objekto tipas", isHeading: true },
    address: { label: "Adresas" },
    status: { label: "Būklė" },
    hazardLevel: { label: "Pavojingumas aplinkai" },
    evaluationDate: { label: "Vertinimo data" },
    siteNumber: { label: "Objekto Nr." },
  },
};

// Per-panel data provenance. `name` is the human-readable registry a citizen
// can recognise; `api` is the technical endpoint/dataset for verification. Shown
// small and muted at the bottom of each expanded panel — trustworthy, not loud.
type SourceInfo = { name: string; api: string };
const PANEL_SOURCES: Record<string, SourceInfo> = {
  "osp-parcel-summary": { name: "Nekilnojamojo turto registras (VDA / OSP)", api: "OSP · ntr_sklypai" },
  "biip-boundary": { name: "BĮIP – sklypų ribos ir paskirtis", api: "biip.lt · boundaries" },
  "biip-addresses": { name: "BĮIP – adresų registras", api: "biip.lt · addresses" },
  "grpk-buildings": { name: "Georeferencinio pagrindo kadastras (GRPK)", api: "geoportal.lt · GRPK (sujungta su BĮIP / OSP)" },
  "pdbis-building-data": { name: "Pastatų duomenų bankas", api: "OSP · pastatai_geo" },
  "geoportal-constraints": { name: "Saugomų teritorijų kadastras (VSTT)", api: "OSP · vstt_stvk" },
  "kvr-heritage": { name: "Kultūros vertybių registras (KVR)", api: "OSP · KPD / kvr" },
  "asgr-regulations": { name: "Teritorijų planavimo dokumentų registras (TPDR)", api: "planuojustatau.lt · ASGR" },
  "szns-restrictions": { name: "Specialiosios žemės naudojimo sąlygos (Registrų centras)", api: "geoportal.lt · rc_szns" },
  "osp-building-permits": { name: "Infostatyba – statybos leidimai", api: "OSP · infostatyba" },
  "osp-pollution-risks": { name: "Potencialūs taršos židiniai", api: "OSP · potencialus_tarsos_zidiniai" },
  "rc-masvert": { name: "Registrų centras – masinis vertinimas", api: "registrucentras.lt · masvert" },
};

// Lithuanian panel titles (server titles are English / mixed).
const PANEL_TITLES: Record<string, string> = {
  "osp-parcel-summary": "Registrų duomenys (VDA / OSP)",
  "biip-boundary": "Sklypo ribos ir paskirtis",
  "biip-addresses": "Adresai ir patalpos",
  "grpk-buildings": "Pastatai sklype",
  "pdbis-building-data": "Pastatų duomenų bankas",
  "geoportal-constraints": "Saugomos teritorijos",
  "kvr-heritage": "Kultūros paveldas",
  "asgr-regulations": "Teritorijų planavimo reglamentai",
  "szns-restrictions": "Specialiosios žemės naudojimo sąlygos",
  "osp-building-permits": "Statybos leidimai (Infostatyba)",
  "osp-pollution-risks": "Taršos ir aplinkos rizikos",
  "rc-masvert": "Vidutinė rinkos vertė (masinis vertinimas)",
};

// Four reader-friendly groups instead of 12 loose panels.
export const CATEGORIES: { id: string; title: string; panelKeys: string[] }[] = [
  {
    id: "sklypas",
    title: "Sklypas ir adresai",
    panelKeys: ["biip-boundary", "osp-parcel-summary", "rc-masvert", "biip-addresses"],
  },
  {
    id: "pastatai",
    title: "Pastatai",
    panelKeys: ["grpk-buildings", "pdbis-building-data"],
  },
  {
    id: "statyba",
    title: "Statyba ir planavimas",
    panelKeys: ["osp-building-permits", "asgr-regulations"],
  },
  {
    id: "apribojimai",
    title: "Apribojimai ir saugomos teritorijos",
    panelKeys: [
      "geoportal-constraints",
      "kvr-heritage",
      "szns-restrictions",
      "osp-pollution-risks",
    ],
  },
];

export type CuratedField = { label: string; value: string; isLink?: boolean };
export type CuratedItem = { heading?: string; fields: CuratedField[] };
export type CuratedPanel = {
  key: string;
  title: string;
  state: "ok" | "empty" | "unavailable";
  count: number;
  message?: string; // shown when empty / unavailable
  items: CuratedItem[];
  source?: SourceInfo;
};
export type CuratedCategory = { id: string; title: string; panels: CuratedPanel[] };

function formatScalar(value: unknown, unit?: string): string {
  let out: string;
  if (typeof value === "boolean") out = value ? "Taip" : "Ne";
  else if (typeof value === "number") out = value.toLocaleString("lt-LT");
  else out = String(value);
  return unit ? `${out} ${unit}` : out;
}

function curatePanel(panel: ParcelReport["reportPanels"][number]): CuratedPanel {
  const title = PANEL_TITLES[panel.key] ?? panel.title;
  const rules = FIELD_RULES[panel.key] ?? {};
  const source = PANEL_SOURCES[panel.key];

  if (panel.status === "error" || panel.status === "partial") {
    return {
      key: panel.key,
      title,
      state: "unavailable",
      count: 0,
      message: "Šių duomenų šiuo metu gauti nepavyko.",
      items: [],
      source,
    };
  }

  const items: CuratedItem[] = (panel.items as RawItem[]).map((raw) => {
    let heading: string | undefined;
    const fields: CuratedField[] = [];

    for (const [key, rule] of Object.entries(rules)) {
      const value = raw[key];
      if (isNoiseValue(value)) continue;
      if (rule.isHeading) {
        heading = formatScalar(value);
        continue;
      }
      fields.push({
        label: rule.label,
        value: rule.isUniqueNumber
          ? formatUniqueNumber(String(value))
          : formatScalar(value, rule.unit),
        isLink: rule.isLink,
      });
    }

    return { heading, fields };
  });

  // Drop items that ended up entirely empty after filtering.
  const visibleItems = items.filter((it) => it.heading || it.fields.length > 0);

  return {
    key: panel.key,
    title,
    state: visibleItems.length > 0 ? "ok" : "empty",
    count: visibleItems.length,
    message: visibleItems.length === 0 ? "Įrašų nerasta." : undefined,
    items: visibleItems,
    source,
  };
}

export function curateReport(report: ParcelReport): CuratedCategory[] {
  const byKey = new Map<string, ParcelReport["reportPanels"][number]>();
  for (const panel of report.reportPanels) {
    if (HIDDEN_PANEL_KEYS.has(panel.key)) continue;
    byKey.set(panel.key, panel);
  }

  return CATEGORIES.map((cat) => ({
    id: cat.id,
    title: cat.title,
    panels: cat.panelKeys
      .map((k) => byKey.get(k))
      .filter((p): p is ParcelReport["reportPanels"][number] => Boolean(p))
      .map(curatePanel),
  })).filter((cat) => cat.panels.length > 0);
}

// ---------------------------------------------------------------------------
// Summary ("Santrauka") — the few facts an elderly reader actually came for.
// Derived from the raw panels; never hand-duplicated.
// ---------------------------------------------------------------------------

export type SummaryFact = { label: string; value: string };
export type SummaryFlag = {
  label: string;
  state: "clear" | "present" | "info";
  detail: string;
  panelKey?: string; // the detailed panel this flag jumps to when clicked
};
export type ReportSummary = {
  facts: SummaryFact[];
  flags: SummaryFlag[];
};

function findPanel(report: ParcelReport, key: string) {
  return report.reportPanels.find((p) => p.key === key);
}

function firstItem(report: ParcelReport, key: string): RawItem | undefined {
  const panel = findPanel(report, key);
  if (!panel || panel.status === "error") return undefined;
  return (panel.items as RawItem[])[0];
}

// Count real (data-bearing) items in a panel, ignoring unavailable/empty panels.
function dataCount(report: ParcelReport, key: string): number {
  const panel = findPanel(report, key);
  if (!panel || panel.status !== "ok") return 0;
  return (panel.items as RawItem[]).length;
}

// Geometric centre of the parcel outline, used as an honest secondary locator
// when there is no street address. Undefined when the outline is unknown (the
// server sends an empty polygon rather than a fabricated point).
export function parcelCenter(report: ParcelReport): { lat: number; lng: number } | undefined {
  const ring = report.coordinates.coordinates[0] ?? [];
  if (ring.length === 0) return undefined;
  let sumLng = 0;
  let sumLat = 0;
  for (const [lng, lat] of ring) {
    sumLng += lng;
    sumLat += lat;
  }
  return { lat: sumLat / ring.length, lng: sumLng / ring.length };
}

// Parcel's unique registry number ("unikalus daikto numeris"), shown next to the
// cadastral number in the summary header. Lives on the BIIP boundary item.
export function findParcelUniqueNumber(report: ParcelReport): string | undefined {
  const value = firstItem(report, "biip-boundary")?.uniqueNumber;
  if (value == null || isNoiseValue(value)) return undefined;
  return formatUniqueNumber(String(value));
}

export function buildSummary(report: ParcelReport): ReportSummary {
  const facts: SummaryFact[] = [];

  const boundary = firstItem(report, "biip-boundary");
  const ospSummary = firstItem(report, "osp-parcel-summary");

  // Plotas — prefer the cadastral boundary value, fall back to the OSP registry.
  const areaHa =
    (boundary?.areaHectares as number | undefined) ??
    (ospSummary?.registeredAreaHa as number | undefined);
  if (areaHa != null && !isNoiseValue(areaHa)) {
    facts.push({ label: "Sklypo plotas", value: `${areaHa.toLocaleString("lt-LT")} ha` });
  }

  // Paskirtis — derived from "Naudojimo būdas" (landUse): the specific permitted
  // use says more to a reader than the broad purpose group. Fall back to the
  // purpose group only when the use method is missing.
  const purpose = boundary?.landUse ?? boundary?.landPurpose;
  if (purpose && !isNoiseValue(purpose)) {
    facts.push({ label: "Paskirtis", value: String(purpose) });
  }

  // Pastatų skaičius — footprints drawn on the map are the most trustworthy count.
  const buildingCount =
    report.buildings?.length ??
    (typeof ospSummary?.buildingsCount === "number" ? ospSummary.buildingsCount : undefined);
  if (buildingCount != null) {
    facts.push({
      label: "Pastatai sklype",
      value: buildingCount === 0 ? "Nėra" : `${buildingCount}`,
    });
  }

  // Vidutinė rinkos vertė — RC mass valuation (registrucentras.lt masvert).
  const marketValue = firstItem(report, "rc-masvert")?.marketValueEur;
  if (typeof marketValue === "number" && marketValue > 0) {
    facts.push({
      label: "Vidutinė rinkos vertė",
      value: `${marketValue.toLocaleString("lt-LT")} €`,
    });
  }

  // Flags — the yes/no answers a buyer/owner worries about.
  const flags: SummaryFlag[] = [];

  const protectedCount = dataCount(report, "geoportal-constraints");
  flags.push({
    label: "Saugomos teritorijos",
    state: protectedCount > 0 ? "present" : "clear",
    detail: protectedCount > 0 ? `Yra (${protectedCount})` : "Nėra",
    panelKey: "geoportal-constraints",
  });

  const heritageCount = dataCount(report, "kvr-heritage");
  flags.push({
    label: "Kultūros paveldas",
    state: heritageCount > 0 ? "present" : "clear",
    detail: heritageCount > 0 ? `Yra (${heritageCount})` : "Nėra",
    panelKey: "kvr-heritage",
  });

  const pollutionCount = dataCount(report, "osp-pollution-risks");
  flags.push({
    label: "Taršos rizika",
    state: pollutionCount > 0 ? "present" : "clear",
    detail: pollutionCount > 0 ? `Yra (${pollutionCount})` : "Nėra",
    panelKey: "osp-pollution-risks",
  });

  // SŽNS feature data is gated upstream — be honest rather than imply "Nėra".
  const szns = findPanel(report, "szns-restrictions");
  if (szns && szns.status !== "ok") {
    flags.push({
      label: "Specialiosios naudojimo sąlygos",
      state: "info",
      detail: "Tikrinti atskirai",
      panelKey: "szns-restrictions",
    });
  }

  return { facts, flags };
}
