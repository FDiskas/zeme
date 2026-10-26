import type { ParcelReport } from "@zeme/shared";
import { DATA_SOURCES } from "./data-sources";
import { parcelPolygons, perimeterM, pointInPolygons, polygonAreaM2, ringCentre } from "./geo";

// ---------------------------------------------------------------------------
// Curation layer
//
// The server returns many raw panels, each a flat record of English machine-named
// fields straight from the upstream registries (many empty / "N/A" / metadata).
// Rendering that verbatim is what made the report "padrika, sunkiai skaitoma".
//
// This module is the single place that decides, for an elderly Lithuanian
// reader: which fields matter, what they are called in Lithuanian, how they are
// grouped, and which few facts deserve to be lifted into a top summary card.
// Nothing here fetches or mutates data — it is purely presentational.
// ---------------------------------------------------------------------------

type RawItem = Record<string, unknown>;

// Panels whose server note is a reading guide the numbers need ("per 1×1 km
// square", data date, where to check exact flood extents) rather than a count
// that repeats the items. Shown under the items, or as the empty-state message.
const NOTE_PANEL_KEYS = new Set([
  "nearby-services",
  "crime-stats",
  "census-households",
  "broadband",
  "flood-risk",
]);

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
  if (typeof value === "string")
    return NOISE_VALUES.has(value.trim().toLowerCase());
  return false;
}

type FieldRule = {
  label: string;
  unit?: string;
  isHeading?: boolean; // use this field as the card's heading instead of a row
  isLink?: boolean;
  isUniqueNumber?: boolean; // format as 4400-4756-6034 (grouped registry number)
  linksToParcelAtPoint?: boolean; // link the value to the parcel at the item's lat/lng
  wide?: boolean; // long text (addresses, names): spans both grid columns
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
    address: { label: "Adresas", wide: true },
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
  "ssva-built-up": {
    densityPct: { label: "Užstatymo tankis", unit: "%" },
    intensity: { label: "Užstatymo intensyvumas" },
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
    name: { label: "Pavadinimas", wide: true },
    classifier: { label: "Klasifikatorius" },
    status: { label: "Statusas" },
    significance: { label: "Reikšmingumas" },
    address: { label: "Adresas", wide: true },
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
    buildingDescription: { label: "Statinio pavadinimas", wide: true },
    buildingPurpose: { label: "Statinio paskirtis" },
    buildingCategory: { label: "Kategorija" },
    constructionType: { label: "Statybos rūšis" },
    address: { label: "Adresas", wide: true },
    projectYear: { label: "Projekto metai" },
  },
  "rc-masvert": {
    marketValueEur: { label: "Daikto vertė", unit: "€" },
    valuationDate: { label: "Vertinimo data" },
    note: { label: "Pastaba", wide: true },
  },
  "osp-pollution-risks": {
    siteType: { label: "Objekto tipas", isHeading: true },
    address: { label: "Adresas", wide: true },
    status: { label: "Būklė" },
    hazardLevel: { label: "Pavojingumas aplinkai" },
    evaluationDate: { label: "Vertinimo data" },
    siteNumber: { label: "Objekto Nr." },
  },
  "forest-cutting-permits": {
    cuttingType: { label: "Kirtimo rūšis", isHeading: true },
    validFrom: { label: "Galioja nuo" },
    validTo: { label: "Galioja iki" },
    areaHa: { label: "Kertamas plotas", unit: "ha" },
    dominantSpecies: { label: "Vyraujantys medžiai" },
    forestDistrict: { label: "Girininkija" },
    ownershipForm: { label: "Nuosavybės forma" },
    status: { label: "Statusas" },
  },
  "nearby-services": {
    name: { label: "Pavadinimas", isHeading: true },
    // The short facts pair up first; the address closes every card on a full
    // row, whether or not the optional "Tipas" (health places have none) is there.
    category: { label: "Kas tai" },
    distanceKm: { label: "Atstumas tiesia linija", unit: "km" },
    type: { label: "Tipas" },
    address: { label: "Adresas", linksToParcelAtPoint: true, wide: true },
  },
  "crime-stats": {
    period: { label: "Laikotarpis", isHeading: true },
    allCrimes: { label: "Visos nusikalstamos veikos" },
    thefts: { label: "Vagystės" },
    violentCrimes: { label: "Nusikaltimai žmogaus gyvybei ir sveikatai" },
    publicOrderOffences: { label: "Viešosios tvarkos pažeidimai (administraciniai)" },
    areaAveragePerKm2: { label: "Apylinkių vidurkis 1 km²" },
    comparison: { label: "Palyginimas" },
  },
  "census-households": {
    familyProfile: { label: "Apibendrinimas", isHeading: true },
    households: { label: "Namų ūkių 1 km² plote" },
    withChildrenShare: { label: "Šeimos su vaikais" },
    singlePersonShare: { label: "Vieno asmens namų ūkiai" },
  },
  broadband: {
    technology: { label: "Ryšio technologija", isHeading: true },
    buildings: { label: "Pastatų, kuriuose yra" },
    officialName: { label: "Oficialus pavadinimas" },
  },
  "flood-risk": {
    floodType: { label: "Potvynio tipas", isHeading: true },
    link: { label: "Oficialus potvynių žemėlapis", isLink: true },
  },
};

// Per-panel data provenance. `name` is the human-readable registry a citizen
// can recognise; `api` is the technical endpoint/dataset for verification. Shown
// small and muted at the bottom of each expanded panel — trustworthy, not loud.
// Derived from the single DATA_SOURCES catalog (data-sources.ts) so the panel
// footer and the /duomenu-saltiniai page can never name a source differently.
type SourceInfo = { name: string; api: string };
const PANEL_SOURCES: Record<string, SourceInfo> = Object.fromEntries(
  DATA_SOURCES.filter((s) => s.panelKey).map((s) => [s.panelKey as string, { name: s.name, api: s.api }]),
);

// Lithuanian panel titles (server titles are English / mixed).
const PANEL_TITLES: Record<string, string> = {
  "osp-parcel-summary": "Registrų duomenys (VDA / OSP)",
  "biip-boundary": "Sklypo ribos ir paskirtis",
  "biip-addresses": "Adresai ir patalpos",
  "grpk-buildings": "Pastatai sklype",
  "ssva-built-up": "Esamas užstatymas",
  "pdbis-building-data": "Pastatų duomenų bankas",
  "geoportal-constraints": "Saugomos teritorijos",
  "kvr-heritage": "Kultūros paveldas",
  "asgr-regulations": "Teritorijų planavimo reglamentai",
  "szns-restrictions": "Specialiosios žemės naudojimo sąlygos",
  "osp-building-permits": "Statybos dokumentai (Infostatyba)",
  "osp-pollution-risks": "Taršos ir aplinkos rizikos",
  "rc-masvert": "Vidutinė rinkos vertė (masinis vertinimas)",
  "forest-cutting-permits": "Miško kirtimo leidimai",
  "nearby-services": "Mokyklos, darželiai ir gydymo įstaigos",
  "crime-stats": "Nusikalstamumas aplinkoje",
  "flood-risk": "Potvynių rizika",
  "census-households": "Gyventojai aplinkui (2021 m. surašymas)",
  broadband: "Interneto ryšys aplinkui",
};

// A few reader-friendly groups instead of a long list of loose panels.
export const CATEGORIES: { id: string; title: string; panelKeys: string[] }[] =
  [
    {
      id: "sklypas",
      title: "Sklypas ir adresai",
      panelKeys: [
        "biip-boundary",
        "osp-parcel-summary",
        "rc-masvert",
        "biip-addresses",
      ],
    },
    {
      id: "pastatai",
      title: "Pastatai",
      panelKeys: ["grpk-buildings", "ssva-built-up", "pdbis-building-data"],
    },
    {
      id: "statyba",
      title: "Statyba ir planavimas",
      panelKeys: ["osp-building-permits", "asgr-regulations", "forest-cutting-permits"],
    },
    {
      id: "apribojimai",
      title: "Apribojimai ir saugomos teritorijos",
      panelKeys: [
        "geoportal-constraints",
        "kvr-heritage",
        "szns-restrictions",
        "osp-pollution-risks",
        "flood-risk",
      ],
    },
    {
      id: "aplinka",
      title: "Aplinka ir kaimynystė",
      panelKeys: ["nearby-services", "crime-stats", "census-households", "broadband"],
    },
  ];

// A finite number from a panel field, which may arrive as a number, a numeric
// string, or a "N/A" placeholder.
function num(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : undefined;
}

// ---------------------------------------------------------------------------
// Building documents by stage
//
// Infostatyba holds ~60 document kinds (requests, permits, completion acts,
// unauthorised-construction acts) with as many statuses. A buyer asks three
// things of them: what was built, what is allowed, what went wrong. So the list
// is grouped by stage instead of shown in registry order.
// ---------------------------------------------------------------------------

type PermitStage = "completed" | "permit" | "request" | "violation" | "rejected" | "structure" | "other";

const PERMIT_STAGES: { stage: PermitStage; title: string }[] = [
  { stage: "completed", title: "Užbaigta statyba" },
  { stage: "permit", title: "Išduoti leidimai" },
  { stage: "request", title: "Prašymai" },
  { stage: "violation", title: "Pažeidimai ir privalomieji nurodymai" },
  { stage: "rejected", title: "Atmesta arba nebegalioja" },
  { stage: "structure", title: "Projektuose numatyti statiniai" },
  { stage: "other", title: "Kiti dokumentai" },
];

const REJECTED_STATUS = /^(atmest|nepatenkint|negaliojant|neišduot|nutraukt|nepatvirtint|pasiūlymams nepritarta)/i;

// A rejected or annulled document says nothing about the parcel today, so the
// status wins over the document kind (an annulled violation act is no violation).
// Rows with no document kind at all are not documents but the structures a
// construction project lists (a building, a sewer line).
function permitStage(item: RawItem): PermitStage {
  if (isNoiseValue(item.permitType)) return "structure";
  const type = String(item.permitType);
  if (REJECTED_STATUS.test(String(item.status ?? ""))) return "rejected";
  if (/savavališk|privalomasis nurodymas|sustabdymo aktas/i.test(type)) return "violation";
  if (/^(prašymas|paraiška)/i.test(type)) return "request";
  if (/užbaigim|be nukrypimų/i.test(type)) return "completed";
  if (/^(leidimas|rašytinis pritarimas)/i.test(type)) return "permit";
  return "other";
}

// Stage order, newest document first within a stage; each item carries its
// stage title with the stage's count, ready to render as a sub-heading.
function groupPermits(items: RawItem[]): { raw: RawItem; group: string }[] {
  return PERMIT_STAGES.flatMap(({ stage, title }) => {
    const inStage = items
      .filter((item) => permitStage(item) === stage)
      .sort((a, b) => String(b.issuedDate ?? "").localeCompare(String(a.issuedDate ?? "")));
    return inStage.map((raw) => ({ raw, group: `${title} (${inStage.length})` }));
  });
}

// ---------------------------------------------------------------------------
// Insights: one plain-language sentence per panel on what the finding means for
// the reader. An empty result is an answer too ("does not fall in a protected
// area"), so it gets a sentence rather than a bare "Įrašų nerasta.".
// ---------------------------------------------------------------------------

const PAPER_ONLY_NOTE = "Senesnė, tik popieriuje registruota statyba čia nematoma.";

const INSIGHTS: Record<string, (items: RawItem[]) => string | undefined> = {
  "geoportal-constraints": (items) =>
    items.length > 0
      ? "Sklypas patenka į saugomą teritoriją. Statybai ir ūkinei veiklai gali galioti papildomi reikalavimai, kuriuos nustato teritorijos nuostatai ir planavimo dokumentai."
      : "Sklypas nepatenka į saugomą teritoriją, todėl papildomi gamtosaugos apribojimai netaikomi.",
  "kvr-heritage": (items) =>
    items.length > 0
      ? "Sklype yra kultūros paveldo objektas arba jo apsaugos zona. Statybos ir tvarkymo darbams gali reikėti Kultūros paveldo departamento pritarimo."
      : "Kultūros vertybių registre sklype objektų ar jų apsaugos zonų nerasta.",
  "osp-pollution-risks": (items) =>
    items.length > 0
      ? "Sklype ar šalia jo registruotas potencialus taršos židinys. Prieš perkant verta pasidomėti jo būkle ir, jei reikia, užsakyti grunto tyrimą."
      : "Žinomų potencialių taršos židinių nerasta.",
  "flood-risk": (items) =>
    items.length > 0
      ? "Sklypas kertasi su potvynių rizikos zona. Tai gali turėti įtakos statybai, pamatų sprendiniams ir draudimo kainai."
      : undefined,
  "osp-building-permits": (items) => {
    if (items.length === 0) {
      return `Infostatyboje šiam sklypui elektroninių statybos dokumentų nerasta. ${PAPER_ONLY_NOTE}`;
    }
    const violations = items.filter((item) => permitStage(item) === "violation").length;
    return violations > 0
      ? `Rasta statybos pažeidimų dokumentų (${violations}). Prieš perkant verta išsiaiškinti, ar pažeidimai pašalinti. ${PAPER_ONLY_NOTE}`
      : PAPER_ONLY_NOTE;
  },
  "asgr-regulations": (items) => {
    if (items.length === 0) return undefined;
    const withLimits = items.find((item) => num(item.maxHeightM) || num(item.maxDensityPct) || num(item.maxIntensity));
    if (!withLimits) {
      return "Šiame reglamente konkretūs užstatymo dydžiai (aukštis, tankis) nenurodyti. Juos tikslinkite savivaldybėje arba detaliajame plane.";
    }
    const limits = [
      num(withLimits.maxHeightM) ? `pastatų aukštis iki ${formatScalar(num(withLimits.maxHeightM), "m")}` : null,
      num(withLimits.maxDensityPct) ? `užstatymo tankis iki ${formatScalar(num(withLimits.maxDensityPct), "%")}` : null,
      num(withLimits.maxIntensity) ? `užstatymo intensyvumas iki ${formatScalar(num(withLimits.maxIntensity))}` : null,
    ].filter(Boolean);
    return `Galiojantis reglamentas leidžia: ${limits.join(", ")}.`;
  },
  "ssva-built-up": (items) =>
    items.length > 0
      ? "Tankis rodo, kurią sklypo dalį užima pastatai ir stogais dengti statiniai; intensyvumas – kiek kartų pastatų bendrasis plotas didesnis už sklypo plotą. Juos galima lyginti su planavimo reglamento leidžiamais dydžiais."
      : undefined,
  "grpk-buildings": (items) =>
    items.length > 0
      ? "Pastatų kontūrai iš georeferencinio pagrindo kadastro. Oficialų užstatymo plotą nurodo kadastro byla."
      : "Sklype pastatų kontūrų nerasta.",
  "rc-masvert": (items) =>
    items.some((item) => num(item.marketValueEur))
      ? "Tai Registrų centro masiniu vertinimu nustatyta statistinė vertė, ne konkretaus sandorio kaina. Reali rinkos kaina gali skirtis."
      : undefined,
  "szns-restrictions": () =>
    "Apsaugos zonų ir servitutų duomenis Registrų centras teikia tik pagal sutartį, todėl jų čia neparodome. Pasitikrinkite Nekilnojamojo turto registro išraše arba geoportal.lt žemėlapyje.",
};

export type CuratedField = {
  label: string;
  value: string;
  isLink?: boolean;
  href?: string; // in-site route the value links to
  wide?: boolean;
};

// In-site route that finds the parcel under a point and opens its report.
export function parcelAtPointHref(lat: number, lng: number): string {
  return `/vieta?lat=${lat}&lng=${lng}`;
}
// `group` is a sub-heading the item sits under (building documents by stage).
export type CuratedItem = { heading?: string; group?: string; fields: CuratedField[] };
export type CuratedPanel = {
  key: string;
  title: string;
  state: "ok" | "empty" | "unavailable";
  count: number;
  message?: string; // shown when empty / unavailable
  insight?: string; // plain-language meaning of the finding, shown first
  note?: string; // reading guide under the items (scope, data date)
  items: CuratedItem[];
  source?: SourceInfo;
};
export type CuratedCategory = {
  id: string;
  title: string;
  panels: CuratedPanel[];
};

function formatScalar(value: unknown, unit?: string): string {
  let out: string;
  if (typeof value === "boolean") out = value ? "Taip" : "Ne";
  else if (typeof value === "number") out = value.toLocaleString("lt-LT");
  else out = String(value);
  return unit ? `${out} ${unit}` : out;
}

function curatePanel(
  panel: ParcelReport["reportPanels"][number],
): CuratedPanel {
  const title = PANEL_TITLES[panel.key] ?? panel.title;
  const rules = FIELD_RULES[panel.key] ?? {};
  const source = PANEL_SOURCES[panel.key];

  const insightFor = INSIGHTS[panel.key];

  // An upstream failure is not an empty result: say no answer came back, never
  // "Įrašų nerasta." (which would read as a clean bill). Panels gated by design
  // (SŽNS) explain themselves through their insight instead.
  if (panel.status === "error" || panel.status === "partial") {
    return {
      key: panel.key,
      title,
      state: "unavailable",
      count: 0,
      message:
        panel.status === "partial" && insightFor
          ? insightFor([])
          : "Duomenų gauti nepavyko. Pabandykite atnaujinti vėliau.",
      items: [],
      source,
    };
  }

  const rawItems = panel.items as RawItem[];
  const ordered =
    panel.key === "osp-building-permits"
      ? groupPermits(rawItems)
      : rawItems.map((raw) => ({ raw, group: undefined }));

  const items: CuratedItem[] = ordered.map(({ raw, group }) => {
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
        href:
          rule.linksToParcelAtPoint && typeof raw.lat === "number" && typeof raw.lng === "number"
            ? parcelAtPointHref(raw.lat, raw.lng)
            : undefined,
        wide: rule.wide,
      });
    }

    return { heading, group, fields };
  });

  // Drop items that ended up entirely empty after filtering.
  const visibleItems = items.filter((it) => it.heading || it.fields.length > 0);

  const note = NOTE_PANEL_KEYS.has(panel.key) ? panel.note : undefined;
  const insight = insightFor?.(rawItems);
  return {
    key: panel.key,
    title,
    state: visibleItems.length > 0 ? "ok" : "empty",
    count: visibleItems.length,
    message: visibleItems.length === 0 ? (insight ?? note ?? "Įrašų nerasta.") : undefined,
    insight: visibleItems.length > 0 ? insight : undefined,
    note: visibleItems.length > 0 ? note : undefined,
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

// `hint` is a short secondary line under the value (an allowed maximum).
export type SummaryFact = { label: string; value: string; hint?: string };
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

// Yes/no flag over a panel's records. A check that failed upstream is unknown,
// never "Nėra": a clean answer must come from a source that actually answered.
function presenceFlag(report: ParcelReport, key: string, label: string): SummaryFlag {
  const panel = findPanel(report, key);
  if (!panel || panel.status !== "ok") {
    return { label, state: "info", detail: "Nepavyko patikrinti", panelKey: key };
  }
  const count = panel.items.length;
  return {
    label,
    state: count > 0 ? "present" : "clear",
    detail: count > 0 ? `Yra (${count})` : "Nėra",
    panelKey: key,
  };
}

// Buildings whose footprint centre lies inside the parcel. The GRPK query also
// returns neighbours' buildings that merely touch the boundary.
function buildingsInParcel(report: ParcelReport): ParcelReport["buildings"] {
  const polygons = parcelPolygons(report);
  if (!report.buildings || polygons.length === 0) return report.buildings;
  return report.buildings.filter((building) => {
    const outer = building.geometry.coordinates[0];
    return outer !== undefined && outer.length > 0 && pointInPolygons(ringCentre(outer), polygons);
  });
}

const formatM2 = (m2: number) => `${Math.round(m2).toLocaleString("lt-LT")}\u00a0m²`;
const formatPct = (pct: number) => `${pct.toLocaleString("lt-LT", { maximumFractionDigits: 1 })}\u00a0%`;

// Užstatymas: how much of the parcel is built on and how much floor area stands
// on it. SSVA ratios come first: they count roofed structures too and draw the
// gross floor area from the property register. Without them, the built-up area
// falls back to the sum of our own building footprints. Where the planning
// regulation sets a maximum density or intensity, the allowed amount is shown
// alongside, so an owner sees how much more may be built.
function builtUpFacts(
  report: ParcelReport,
  areaHa: number | undefined,
  buildings: ParcelReport["buildings"],
): SummaryFact[] {
  if (!areaHa) return [];
  const parcelM2 = areaHa * 10000;
  const ssva = firstItem(report, "ssva-built-up");

  const regulations = (findPanel(report, "asgr-regulations")?.items ?? []) as RawItem[];
  const firstLimit = (field: string) =>
    regulations.map((item) => num(item[field])).find((value) => value !== undefined && value > 0);
  const allowedPct = firstLimit("maxDensityPct");
  const allowedIntensity = firstLimit("maxIntensity");

  let builtM2: number | undefined;
  const densityPct = num(ssva?.densityPct);
  if (densityPct) builtM2 = (densityPct / 100) * parcelM2;
  else if (buildings && buildings.length > 0) {
    builtM2 = buildings.reduce(
      (sum, b) => sum + (b.areaSqM ?? polygonAreaM2(b.geometry.coordinates)),
      0,
    );
  }

  const facts: SummaryFact[] = [];
  if (builtM2) {
    facts.push({
      label: "Užstatytas plotas",
      value: `≈ ${formatM2(builtM2)} (${formatPct((builtM2 / parcelM2) * 100)})`,
      hint: allowedPct ? `Leidžiama iki ${formatPct(allowedPct)}` : undefined,
    });
  }
  const intensity = num(ssva?.intensity);
  if (intensity) {
    facts.push({
      label: "Pastatų bendrasis plotas",
      value: `≈ ${formatM2(intensity * parcelM2)}`,
      hint: allowedIntensity ? `Leidžiama iki ≈ ${formatM2(allowedIntensity * parcelM2)}` : undefined,
    });
  }
  return facts;
}

// Distance to the nearest place of one category in the nearby-services panel
// (items arrive sorted nearest-first per category).
function nearestDistanceKm(report: ParcelReport, category: string): number | undefined {
  const panel = findPanel(report, "nearby-services");
  if (!panel || panel.status === "error") return undefined;
  const item = (panel.items as RawItem[]).find((i) => i.category === category);
  return typeof item?.distanceKm === "number" ? item.distanceKm : undefined;
}

// Geometric centre of the parcel outline, used as an honest secondary locator
// when there is no street address. Undefined when the outline is unknown (the
// server sends an empty polygon rather than a fabricated point).
export function parcelCenter(
  report: ParcelReport,
): { lat: number; lng: number } | undefined {
  const ring = parcelPolygons(report)[0]?.[0] ?? [];
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
export function findParcelUniqueNumber(
  report: ParcelReport,
): string | undefined {
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
    facts.push({
      label: "Sklypo plotas",
      value: `${areaHa.toLocaleString("lt-LT")} ha`,
    });
  }

  const polygons = parcelPolygons(report);
  if (polygons.length > 0) {
    facts.push({ label: "Perimetras", value: `${Math.round(perimeterM(polygons)).toLocaleString("lt-LT")} m` });
  }

  // Paskirtis — derived from "Naudojimo būdas" (landUse): the specific permitted
  // use says more to a reader than the broad purpose group. Fall back to the
  // purpose group only when the use method is missing.
  const purpose = boundary?.landUse ?? boundary?.landPurpose;
  if (purpose && !isNoiseValue(purpose)) {
    facts.push({ label: "Paskirtis", value: String(purpose) });
  }

  // Pastatų skaičius — footprints inside the parcel are the most trustworthy count.
  const buildings = buildingsInParcel(report);
  const buildingCount =
    buildings?.length ??
    (typeof ospSummary?.buildingsCount === "number"
      ? ospSummary.buildingsCount
      : undefined);
  if (buildingCount != null) {
    facts.push({
      label: "Pastatai sklype",
      value: buildingCount === 0 ? "Nėra" : `${buildingCount}`,
    });
  }

  facts.push(...builtUpFacts(report, areaHa, buildings));

  // Vidutinė rinkos vertė — RC mass valuation (registrucentras.lt masvert).
  const marketValue = firstItem(report, "rc-masvert")?.marketValueEur;
  if (typeof marketValue === "number" && marketValue > 0) {
    facts.push({
      label: "Vidutinė rinkos vertė",
      value: `${marketValue.toLocaleString("lt-LT")} €`,
    });
  }

  // Artimiausia mokykla / darželis — the distance a family asks about first.
  for (const [category, label] of [
    ["Mokykla", "Artimiausia mokykla"],
    ["Darželis", "Artimiausias darželis"],
  ] as const) {
    const distanceKm = nearestDistanceKm(report, category);
    if (distanceKm != null) {
      facts.push({ label, value: `${distanceKm.toLocaleString("lt-LT")} km` });
    }
  }

  // Flags — the yes/no answers a buyer/owner worries about.
  const flags: SummaryFlag[] = [];

  flags.push(presenceFlag(report, "geoportal-constraints", "Saugomos teritorijos"));
  flags.push(presenceFlag(report, "kvr-heritage", "Kultūros paveldas"));
  flags.push(presenceFlag(report, "osp-pollution-risks", "Taršos rizika"));

  // Unauthorised construction or binding orders — raised only when present: the
  // registry covers electronic records only, so absence is no proof of a clean past.
  const permits = findPanel(report, "osp-building-permits");
  const violations =
    permits?.status === "ok"
      ? (permits.items as RawItem[]).filter((item) => permitStage(item) === "violation").length
      : 0;
  if (violations > 0) {
    flags.push({
      label: "Statybos pažeidimai",
      state: "present",
      detail: `Yra (${violations})`,
      panelKey: "osp-building-permits",
    });
  }

  const floodPanel = findPanel(report, "flood-risk");
  if (floodPanel?.status === "ok") {
    const floodCount = floodPanel.items.length;
    flags.push({
      label: "Potvynių rizika",
      state: floodCount > 0 ? "present" : "clear",
      detail: floodCount > 0 ? "Yra" : "Nėra",
      panelKey: "flood-risk",
    });
  }

  // Crime — the full-year item carries the comparison with the surroundings.
  const crimePanel = findPanel(report, "crime-stats");
  const crimeYear = crimePanel?.status === "ok"
    ? (crimePanel.items as RawItem[]).find((item) => typeof item.comparison === "string")
    : undefined;
  if (crimeYear) {
    const level = crimeYear.comparisonLevel;
    flags.push({
      label: "Nusikalstamumas",
      state: level === "higher" ? "present" : level === "lower" ? "clear" : "info",
      detail: String(crimeYear.comparison),
      panelKey: "crime-stats",
    });
  }

  // Šviesolaidis — fibre in the surrounding 1 km² cell. Absence is shown as
  // neutral info, not a warning: copper/wireless still gives a connection.
  const broadbandPanel = findPanel(report, "broadband");
  if (broadbandPanel?.status === "ok") {
    const technologies = broadbandPanel.items as RawItem[];
    const hasFibre = technologies.some((item) => String(item.technology).startsWith("Šviesolaidis"));
    flags.push({
      label: "Šviesolaidinis internetas aplinkui",
      state: hasFibre ? "clear" : "info",
      detail: hasFibre ? "Yra" : technologies.length > 0 ? "Nėra" : "Nėra duomenų",
      panelKey: "broadband",
    });
  }

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
