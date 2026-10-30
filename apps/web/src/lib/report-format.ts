import { describeCrimeComparison, ltCount, type ParcelReport, type ReportPanelKey } from "@zeme/shared";
import { DATA_SOURCES } from "./data-sources";
import { buildingsInParcel, parcelPolygons, perimeterM, polygonAreaM2 } from "./geo";

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
  "energy-certificates",
]);

// Panels that always hold one record — the parcel's own registry entry, its
// valuation — where a "1 įrašas" count would say nothing.
const SINGLE_RECORD_PANEL_KEYS = new Set([
  "biip-boundary",
  "osp-parcel-summary",
  "rc-masvert",
  "ssva-built-up",
  "census-households",
]);

// What a panel's records are, so the closed row can say "3 laikotarpiai"
// rather than a bare "3" a reader takes for three crimes.
const COUNT_NOUNS: Record<string, readonly [string, string, string]> = {
  "biip-addresses": ["adresas", "adresai", "adresų"],
  "grpk-buildings": ["pastatas", "pastatai", "pastatų"],
  "pdbis-building-data": ["pastatas", "pastatai", "pastatų"],
  "osp-building-permits": ["dokumentas", "dokumentai", "dokumentų"],
  "asgr-regulations": ["reglamentas", "reglamentai", "reglamentų"],
  "nearby-services": ["įstaiga", "įstaigos", "įstaigų"],
  "crime-stats": ["laikotarpis", "laikotarpiai", "laikotarpių"],
  broadband: ["technologija", "technologijos", "technologijų"],
  "energy-certificates": ["pastatas", "pastatai", "pastatų"],
  "szns-restrictions": ["sąlyga", "sąlygos", "sąlygų"],
};
const DEFAULT_COUNT_NOUN = ["įrašas", "įrašai", "įrašų"] as const;

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

// "Tilto g. 2A, Vilniaus m." out of a full address, for one-line lists. BIIP
// writes from the municipality down ("Vilniaus m. sav., Senamiesčio sen.,
// Vilniaus m., Tilto g. 2A"), OpenStreetMap from the house number up ("2A,
// Tilto g., Vilnius, …, Lietuva"); both drop to street and place.
export function shortAddress(address: string): string {
  const parts = address.split(",").map((part) => part.trim());
  const biipOrder = /\bsav\.$/.test(parts[0] ?? "");
  const kept = parts.filter(
    (part) => part !== "" && part !== "Lietuva" && !/^\d{5}$/.test(part) && !/(sav\.|savivaldybė|sen\.|seniūnija|apskritis)$/.test(part),
  );
  if (biipOrder) kept.reverse();
  else if (kept.length > 1 && /^\d+\w*$/.test(kept[0]!)) kept.splice(0, 2, `${kept[1]} ${kept[0]}`);
  return kept.slice(0, 2).join(", ") || address;
}

export function isNoiseValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string")
    return NOISE_VALUES.has(value.trim().toLowerCase());
  return false;
}

// The main land-use purposes, by the name the cadastre gives and the code the
// planning registry (TPDR) uses. Readers meet both on one page, so each is
// shown with the other: "Kita (KT)".
const LAND_PURPOSES = [
  { code: "KT", name: "Kita", full: "Kitos paskirties žemė, skirta statybai" },
  { code: "Ž", name: "Žemės ūkio", full: "Žemės ūkio paskirties žemė" },
  { code: "M", name: "Miškų ūkio", full: "Miškų ūkio paskirties žemė" },
  { code: "K", name: "Konservacinė", full: "Konservacinės paskirties žemė" },
  { code: "V", name: "Vandens ūkio", full: "Vandens ūkio paskirties žemė" },
];

function landPurposeByName(name: string) {
  return LAND_PURPOSES.find((purpose) => purpose.name.toLowerCase() === name.trim().toLowerCase());
}

// "Kita" → "Kita (KT)"; an unknown purpose is left as it is.
function describeLandPurpose(name: string): string {
  const purpose = landPurposeByName(name);
  return purpose ? `${purpose.name} (${purpose.code})` : name;
}

// "Pagrindinė žemės naudojimo paskirtis: KT." → "… paskirtis: Kita (KT)."
function decodePurposeCodes(text: string): string {
  return text.replace(/(^|:\s*)(KT|Ž|M|K|V)(?=\.?$)/, (_, lead: string, code: string) => {
    const purpose = LAND_PURPOSES.find((p) => p.code === code)!;
    return `${lead}${purpose.name} (${code})`;
  });
}

// The TPDR map searches planning documents by number.
const TPDR_MAP_URL = "https://tpdr.planuojustatau.lt/map/main.html";

// Our server finds a building document's Infostatyba project page by the
// building's address and the project's name (the open data has no link).
function infostatybaHref(raw: RawItem): string | undefined {
  const address = raw.address;
  if (typeof address !== "string" || isNoiseValue(address)) return undefined;
  const name = typeof raw.projectName === "string" && !isNoiseValue(raw.projectName) ? raw.projectName : "";
  return `/api/infostatyba?${new URLSearchParams({ adresas: address, pavadinimas: name })}`;
}

type FieldRule = {
  label: string;
  unit?: string;
  isHeading?: boolean; // use this field as the card's heading instead of a row
  isLink?: boolean;
  isUniqueNumber?: boolean; // format as 4400-4756-6034 (grouped registry number)
  linksToParcelAtPoint?: boolean; // link the value to the parcel at the item's lat/lng
  wide?: boolean; // long text (addresses, names): spans both grid columns
  prefixesHeading?: boolean; // shown before the heading ("2021-03-19 · Leidimas…") instead of as a row
  format?: (value: string) => string; // decode a registry code into words
  externalHref?: (value: string, raw: RawItem) => string | undefined; // where the value can be looked up
  inRow?: boolean; // shown on the record's one-line row in a long list
  // A list of names joined with ", " upstream, shown as deduplicated tags.
  // Names that themselves hold commas are recognised from another panel's
  // records (`knownFrom`), so they are not cut apart.
  asTags?: { knownFrom?: string };
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
    protectedAreaNames: { label: "Saugomos teritorijos", wide: true, asTags: { knownFrom: "geoportal-constraints" } },
    culturalHeritageNames: { label: "Kultūros paveldas", wide: true, asTags: { knownFrom: "kvr-heritage" } },
  },
  "biip-boundary": {
    municipality: { label: "Savivaldybė" },
    areaHectares: { label: "Sklypo plotas", unit: "ha" },
    // landPurpose is BIIP's purpose group, which is always "Žemės naudojimo":
    // the name of the group, not a value, so it is left out.
    landUse: { label: "Pagrindinė naudojimo paskirtis", format: describeLandPurpose },
    status: { label: "Statusas" },
    updatedAt: { label: "Atnaujinta" },
  },
  "biip-addresses": {
    type: { label: "Tipas", isHeading: true },
    address: { label: "Adresas", wide: true, inRow: true },
    plotOrBuildingNumber: { label: "Pastato / sklypo Nr." },
    postalCode: { label: "Pašto kodas" },
    roomNumber: { label: "Patalpos Nr." },
  },
  "grpk-buildings": {
    address: { label: "Adresas", isHeading: true },
    areaSqM: { label: "Užstatytas plotas", unit: "m²", inRow: true },
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
  "energy-certificates": {
    address: { label: "Adresas", isHeading: true },
    energyClass: { label: "Energinio naudingumo klasė", inRow: true },
    status: { label: "Sertifikatas" },
    validUntil: { label: "Galioja iki" },
    issued: { label: "Išduotas" },
    certifiedAreaSqM: { label: "Sertifikuotas plotas", unit: "m²" },
    heating: { label: "Šildymas", wide: true },
    certificateNo: { label: "Sertifikato Nr." },
    otherCertificates: { label: "Kiti sertifikatai šiuo adresu" },
    flatCertificates: { label: "Butų sertifikatai", wide: true },
  },
  "geoportal-constraints": {
    type: { label: "Tipas", isHeading: true },
    name: { label: "Pavadinimas" },
  },
  "kvr-heritage": {
    type: { label: "Tipas", isHeading: true },
    name: { label: "Pavadinimas", wide: true, inRow: true },
    classifier: { label: "Klasifikatorius" },
    status: { label: "Statusas", inRow: true },
    significance: { label: "Reikšmingumas" },
    address: { label: "Adresas", wide: true },
    age: { label: "Amžius" },
    zoneType: { label: "Zonos tipas" },
    link: { label: "Daugiau informacijos", isLink: true },
  },
  "asgr-regulations": {
    summary: { label: "Aprašymas", isHeading: true, format: decodePurposeCodes },
    mainPurpose: { label: "Pagrindinė paskirtis", format: decodePurposeCodes },
    useMethod: { label: "Naudojimo būdas" },
    useType: { label: "Naudojimo tipas" },
    functionalZone: { label: "Funkcinė zona" },
    maxHeightM: { label: "Didžiausias aukštis", unit: "m" },
    maxIntensity: { label: "Didžiausias užstatymo intensyvumas" },
    maxDensityPct: { label: "Didžiausias užstatymo tankis", unit: "%" },
    minGreeneryPct: { label: "Mažiausias apželdinimas", unit: "%" },
    // TPDR has no per-document address, so the number leads to its search map.
    documentNo: { label: "Dokumento Nr.", externalHref: () => TPDR_MAP_URL },
    approvedAt: { label: "Patvirtinta" },
  },
  "szns-restrictions": {
    name: { label: "Sąlyga", isHeading: true },
    code: { label: "Kodas", inRow: true },
    zonesCount: { label: "Zonų sklype", inRow: true },
    // RC's PDF of what the conditions forbid or require.
    lawSection: {
      label: "Sąlygų aprašas",
      wide: true,
      externalHref: (_, raw) => (typeof raw.documentUrl === "string" ? raw.documentUrl : undefined),
    },
  },
  "osp-building-permits": {
    issuedDate: { label: "Data", prefixesHeading: true },
    permitType: { label: "Dokumento tipas", isHeading: true },
    // The project's public page, which lists this document with the rest.
    permitNumber: { label: "Dokumento Nr.", externalHref: (_, raw) => infostatybaHref(raw) },
    // Row order reads date · name · status · address.
    buildingDescription: { label: "Statinio pavadinimas", wide: true, inRow: true },
    status: { label: "Statusas", inRow: true },
    buildingPurpose: { label: "Statinio paskirtis" },
    buildingCategory: { label: "Kategorija" },
    constructionType: { label: "Statybos rūšis" },
    address: { label: "Adresas", wide: true, inRow: true },
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
    status: { label: "Būklė", inRow: true },
    hazardLevel: { label: "Pavojingumas aplinkai", inRow: true },
    evaluationDate: { label: "Vertinimo data" },
    siteNumber: { label: "Objekto Nr." },
  },
  "forest-cutting-permits": {
    cuttingType: { label: "Kirtimo rūšis", isHeading: true },
    validFrom: { label: "Galioja nuo", inRow: true },
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
    category: { label: "Kas tai", inRow: true },
    distanceKm: { label: "Atstumas tiesia linija", unit: "km", format: (km) => `~${km}`, inRow: true },
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
// A source's home is linked from "Šaltinis" only where it is a page a person
// can read; these hosts answer with an API description, a bare map service
// or a refusal.
const MACHINE_ONLY_HOSTS = ["boundaries.biip.lt", "osp-sdg.stat.gov.lt", "maps.ird.lt"];
const readerUrl = (url: string) => (MACHINE_ONLY_HOSTS.some((host) => url.includes(host)) ? undefined : url);

type SourceInfo = { name: string; api: string; url?: string; dataDate?: string };
const PANEL_SOURCES: Record<string, SourceInfo> = Object.fromEntries(
  DATA_SOURCES.filter((s) => s.panelKey).map((s) => [s.panelKey as string, { name: s.name, api: s.api, url: readerUrl(s.url) }]),
);

// Lithuanian panel titles (server titles are English / mixed).
export const panelTitle = (key: string) => PANEL_TITLES[key] ?? key;

const PANEL_TITLES: Record<string, string> = {
  "osp-parcel-summary": "Registrų duomenys (VDA / OSP)",
  "biip-boundary": "Sklypo ribos ir paskirtis",
  "biip-addresses": "Adresai ir patalpos",
  "grpk-buildings": "Pastatai sklype",
  "ssva-built-up": "Esamas užstatymas",
  "pdbis-building-data": "Pastatų duomenų bankas",
  "energy-certificates": "Energinis naudingumas",
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
      panelKeys: ["grpk-buildings", "ssva-built-up", "pdbis-building-data", "energy-certificates"],
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
// things of them: what went wrong, how the building came about, and whether
// it was finished. So violations come first, then the valid documents as one
// timeline (request → permit → completion), then what was turned down.
// ---------------------------------------------------------------------------

type PermitStage = "completed" | "permit" | "request" | "violation" | "rejected" | "structure" | "other";

// From this many records a list is "long": it opens as filterable rows, and
// the construction timeline runs newest first, since nobody reads hundreds of
// documents from 2013 onwards to find this year's.
export const LONG_LIST = 12;

// Stages read together as the course of the construction: oldest first while
// the list is short enough to read as a story, newest first once it is long.
const TIMELINE_STAGES = new Set<PermitStage>(["request", "permit", "completed", "other"]);

const PERMIT_GROUPS: { stages: Set<PermitStage>; title: string; oldestFirst: boolean | "while-short" }[] = [
  { stages: new Set(["violation"]), title: "Pažeidimai ir privalomieji nurodymai", oldestFirst: false },
  { stages: TIMELINE_STAGES, title: "Statybos eiga", oldestFirst: "while-short" },
  { stages: new Set(["rejected"]), title: "Atmesta arba nebegalioja", oldestFirst: false },
  { stages: new Set(["structure"]), title: "Projektuose numatyti statiniai", oldestFirst: false },
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

// Group order, by date within a group; each item carries its group title,
// ready to render as a sub-heading (the count is added where the list is
// shown, as a filter can narrow it).
function groupPermits(items: RawItem[]): { raw: RawItem; group: string }[] {
  return PERMIT_GROUPS.flatMap(({ stages, title, oldestFirst }) => {
    const ascending = oldestFirst === "while-short" ? items.length < LONG_LIST : oldestFirst;
    const inGroup = items
      .filter((item) => stages.has(permitStage(item)))
      .sort((a, b) => {
        const order = String(a.issuedDate ?? "").localeCompare(String(b.issuedDate ?? ""));
        return ascending ? order : -order;
      });
    return inGroup.map((raw) => ({ raw, group: title }));
  });
}

const yearOf = (item: RawItem) => /^\d{4}/.exec(String(item.issuedDate ?? ""))?.[0];

// The newest valid document of a kind, for the one-line verdict.
function newestPermit(items: RawItem[], kind: RegExp): RawItem | undefined {
  return items
    .filter((item) => !REJECTED_STATUS.test(String(item.status ?? "")) && kind.test(String(item.permitType ?? "")))
    .sort((a, b) => String(b.issuedDate ?? "").localeCompare(String(a.issuedDate ?? "")))[0];
}

const COMPLETION = /užbaigim/i;
const BUILD_PERMIT = /^(leidimas|rašytinis pritarimas)/i;

// "Užbaigta 2024 m. (garažas)" — what the documents add up to, from the newest
// completion act, or else the newest building permit. `text` fits a summary
// chip; the panel's insight puts "Statyba" in front of a completion.
function permitVerdict(items: RawItem[]): { text: string; completed: boolean; state: FlagState } | undefined {
  const completion = newestPermit(items, COMPLETION);
  if (completion) {
    // Say what was finished: a garage's completion says nothing of the house.
    const year = yearOf(completion);
    const what = String(completion.buildingDescription ?? "");
    const subject = !isNoiseValue(what) && what.length <= 40 ? ` (${what.charAt(0).toLowerCase()}${what.slice(1)})` : "";
    return { text: `Užbaigta${year ? ` ${year}\u00a0m.` : ""}${subject}`, completed: true, state: "good" };
  }
  const permit = newestPermit(items, BUILD_PERMIT);
  if (permit) {
    const year = yearOf(permit);
    return { text: `Leidimas statyti${year ? ` ${year}\u00a0m.` : ""}, užbaigimas neįformintas`, completed: false, state: "check" };
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Insights: one plain-language sentence per panel on what the finding means for
// the reader. An empty result is an answer too ("does not fall in a protected
// area"), so it gets a sentence rather than a bare "Įrašų nerasta.".
// ---------------------------------------------------------------------------

const PAPER_ONLY_NOTE = "Senesnė, tik popieriuje registruota statyba čia nematoma.";

// The nearby-services categories as the row names them, and what it says
// when that lookup brought nothing back.
const NEARBY_KINDS = [
  ["Mokykla", "mokykla", "mokyklos duomenų negauta"],
  ["Darželis", "darželis", "darželio duomenų negauta"],
  ["Gydymo įstaiga", "gydymo įstaiga", "gydymo įstaigos duomenų negauta"],
] as const;

const INSIGHTS: Record<string, (items: RawItem[], note?: string) => string | undefined> = {
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
    if (violations > 0) {
      return `Rasta statybos pažeidimų dokumentų (${violations}). Prieš perkant verta išsiaiškinti, ar pažeidimai pašalinti. ${PAPER_ONLY_NOTE}`;
    }
    const verdict = permitVerdict(items);
    const sentence = verdict && (verdict.completed ? `Statyba u${verdict.text.slice(1)}` : verdict.text);
    // The verdict may already end in "m." — no second period after it.
    const lead = sentence ? `${sentence.replace(/\.$/, "")}. ` : "";
    return `${lead}Pažeidimų dokumentų nerasta. ${PAPER_ONLY_NOTE}`;
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
  // The class a buyer compares, with the scale it sits on; flats alone say
  // nothing about the whole building.
  "energy-certificates": (items) => {
    if (items.length === 0) return undefined;
    const classes = [...new Set(items.map((item) => item.energyClass).filter((c): c is string => typeof c === "string"))];
    if (classes.length === 0) return "Rasti tik atskirų butų sertifikatai, viso pastato sertifikato nėra.";
    const lead = classes.length === 1 ? `Energinio naudingumo klasė – ${classes[0]}.` : `Pastatų energinio naudingumo klasės: ${classes.join(", ")}.`;
    return `${lead} A++–B klasių pastatams šildyti reikia mažai energijos, E–G – daug.`;
  },
  "rc-masvert": (items) =>
    items.some((item) => num(item.marketValueEur))
      ? "Tai Registrų centro masiniu vertinimu nustatyta statistinė vertė, ne konkretaus sandorio kaina. Reali rinkos kaina gali skirtis."
      : undefined,
  // The operators' reporting date, which the summary chip cannot carry.
  broadband: (items, note) => {
    if (items.length === 0) return undefined;
    const date = note?.match(/\d{4}-\d{2}-\d{2}/)?.[0];
    return `${date ? `Operatorių duomenys ${date}. ` : ""}Mobiliojo ryšio (4G/5G) aprėptis čia nevertinama.`;
  },
  // The distance a family asks about first, read in the closed row of
  // "Aplinka ir kaimynystė" (items arrive nearest-first per category). As the
  // crow flies, which the "~" and the words say: by road it is further. A
  // lookup that failed is said, never left out silently.
  "nearby-services": (items) => {
    if (items.length === 0) return undefined;
    const parts = NEARBY_KINDS.map(([category, noun, missing]) => {
      const km = num(items.find((item) => item.category === category)?.distanceKm);
      return km !== undefined ? `${noun} ~${formatScalar(km, "km")}` : missing;
    });
    return `Artimiausia ${parts.join(", ")} tiesia linija.`;
  },
  // The public service names the conditions but not their outline, so how
  // much of the parcel a zone covers is left to the NTR extract.
  "szns-restrictions": (items) =>
    items.length > 0
      ? "Sklypas (bent iš dalies) patenka į šių sąlygų zonas. Ką jose draudžiama ar reikia derinti, rašoma sąlygų apraše. Kokią sklypo dalį zona užima, Registrų centras viešai nerodo: tai matyti Nekilnojamojo turto registro išraše."
      : "Registre sklypui įregistruotų specialiųjų žemės naudojimo sąlygų nerasta. Dalis zonų gali būti dar neįregistruota, todėl prieš sandorį verta pasitikrinti Nekilnojamojo turto registro išraše.",
};

export type CuratedField = {
  label: string;
  value: string;
  isLink?: boolean;
  href?: string; // in-site route the value links to
  externalHref?: string; // another site where the value can be looked up
  tags?: string[]; // a list of names, shown as tags rather than one long line
  inRow?: boolean; // part of the record's one-line row in a long list
  wide?: boolean;
};

// In-site route that finds the parcel under a point and opens its report.
export function parcelAtPointHref(lat: number, lng: number): string {
  return `/vieta?lat=${lat}&lng=${lng}`;
}
// `group` is a sub-heading the item sits under (building documents by stage).
// `year` and `kind` let a long list be filtered (by year, by document type).
export type CuratedItem = { heading?: string; group?: string; year?: string; kind?: string; fields: CuratedField[] };
export type CuratedPanel = {
  key: string;
  title: string;
  state: "ok" | "empty" | "unavailable";
  count: number;
  countLabel?: string; // "3 laikotarpiai"; absent for one-record panels
  compact: boolean; // records render as one-line rows that open for details
  message?: string; // shown when empty / unavailable; absent for a plain "nothing found"
  reason?: string; // why the source failed, in its own words
  insight?: string; // plain-language meaning of the finding, shown first
  note?: string; // reading guide under the items (scope, data date)
  items: CuratedItem[];
  source?: SourceInfo;
};
export type CuratedCategory = {
  id: string;
  title: string;
  panels: CuratedPanel[];
  // Panels whose sources have not answered yet, while the report is built.
  pending: { key: string; title: string }[];
};

// Registry strings carry decimals with a point ("253.9"); readers expect the
// Lithuanian comma. Only plain decimals are converted: years, codes and
// numbers with leading zeros stay as they came.
const DECIMAL_STRING = /^-?\d+\.\d+$/;

function formatScalar(value: unknown, unit?: string): string {
  let out: string;
  if (typeof value === "boolean") out = value ? "Taip" : "Ne";
  else if (typeof value === "number") out = value.toLocaleString("lt-LT");
  else if (typeof value === "string" && DECIMAL_STRING.test(value.trim())) out = Number(value).toLocaleString("lt-LT");
  else out = String(value);
  return unit ? `${out} ${unit}` : out;
}

// Per-panel touch-ups of a raw record before its fields are curated.
const ITEM_ADJUSTERS: Record<string, (item: RawItem) => RawItem> = {
  // The comparison is rewritten from the counts, so cached reports read the
  // same as fresh ones, and a half-year says that the year is not over.
  "crime-stats": (item) => ({
    ...item,
    period: /pusmetis/i.test(String(item.period)) ? `${item.period} (metų duomenys dar nepilni)` : item.period,
    comparison:
      typeof item.allCrimes === "number" && typeof item.areaAveragePerKm2 === "number"
        ? describeCrimeComparison(item.allCrimes, item.areaAveragePerKm2)
        : item.comparison,
  }),
};

// The date a panel's data describe, where the source states one; otherwise
// the data are as of the report itself.
function panelDataDate(panel: ParcelReport["reportPanels"][number]): string | undefined {
  if (panel.key === "osp-parcel-summary") {
    const date = (panel.items as RawItem[])[0]?.cadastralDataDate;
    return typeof date === "string" && !isNoiseValue(date) ? date : undefined;
  }
  if (panel.key === "census-households") return "2021 m. surašymas";
  if (panel.key === "broadband") return panel.note?.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  return undefined;
}

// Names joined with ", " upstream, back as a list without repeats. A name
// that holds a comma itself ("Vilniaus piliavietė, vad. Gedimino kalnu, …")
// is kept whole when it is one of the `known` names.
function splitNames(text: string, known: string[]): string[] {
  const longestFirst = [...known].sort((a, b) => b.length - a.length);
  const names = new Set<string>();
  for (const segment of text.split(";")) {
    let rest = segment.trim();
    while (rest) {
      const name = longestFirst.find((n) => rest === n || rest.startsWith(`${n}, `)) ?? rest.split(", ")[0]!;
      names.add(name.trim());
      rest = rest.slice(name.length).replace(/^,\s*/, "");
    }
  }
  return [...names].filter((name) => !isNoiseValue(name));
}

// The `name` of every record in each panel, for splitNames.
type KnownNames = Map<string, string[]>;

function curatePanel(
  panel: ParcelReport["reportPanels"][number],
  knownNames: KnownNames,
): CuratedPanel {
  const title = PANEL_TITLES[panel.key] ?? panel.title;
  const rules = FIELD_RULES[panel.key] ?? {};
  const source = PANEL_SOURCES[panel.key];
  const sourceWithDate = source ? { ...source, dataDate: panelDataDate(panel) } : undefined;

  const insightFor = INSIGHTS[panel.key];

  // An upstream failure is not an empty result: say no answer came back, never
  // "Įrašų nerasta." (which would read as a clean bill). A partial answer that
  // still brought records (nearby places when one of three lookups failed)
  // shows what came.
  if (panel.status === "error" || (panel.status === "partial" && panel.items.length === 0)) {
    return {
      key: panel.key,
      title,
      state: "unavailable",
      count: 0,
      compact: false,
      message: "Duomenų gauti nepavyko.",
      reason: panel.note,
      items: [],
      source: sourceWithDate,
    };
  }

  const adjust = ITEM_ADJUSTERS[panel.key] ?? ((item: RawItem) => item);
  const rawItems = (panel.items as RawItem[]).map(adjust);
  const ordered =
    panel.key === "osp-building-permits"
      ? groupPermits(rawItems)
      : rawItems.map((raw) => ({ raw, group: undefined }));

  const items: CuratedItem[] = ordered.map(({ raw, group }) => {
    let heading: string | undefined;
    let headingPrefix: string | undefined;
    const fields: CuratedField[] = [];

    for (const [key, rule] of Object.entries(rules)) {
      const value = raw[key];
      if (isNoiseValue(value)) continue;
      const text = rule.isUniqueNumber
        ? formatUniqueNumber(String(value))
        : rule.format
          ? formatScalar(rule.format(formatScalar(value)), rule.unit)
          : formatScalar(value, rule.unit);
      if (rule.isHeading) {
        heading = text;
        continue;
      }
      if (rule.prefixesHeading) {
        headingPrefix = text;
        continue;
      }
      const tags = rule.asTags ? splitNames(String(value), knownNames.get(rule.asTags.knownFrom ?? "") ?? []) : undefined;
      fields.push({
        label: rule.label,
        value: tags ? tags.join(", ") : text,
        tags,
        inRow: rule.inRow,
        isLink: rule.isLink,
        href:
          rule.linksToParcelAtPoint && typeof raw.lat === "number" && typeof raw.lng === "number"
            ? parcelAtPointHref(raw.lat, raw.lng)
            : undefined,
        externalHref: rule.externalHref?.(String(value), raw),
        wide: rule.wide,
      });
    }

    // A dated record (a building document) can be filtered by its year and
    // its kind, the heading before the date is put in front of it.
    const year = headingPrefix ? /^\d{4}/.exec(headingPrefix)?.[0] : undefined;
    const kind = headingPrefix ? heading : undefined;
    if (headingPrefix) heading = heading ? `${headingPrefix} · ${heading}` : headingPrefix;
    return { heading, group, year, kind, fields };
  });

  // Drop items that ended up entirely empty after filtering, and records that
  // read exactly like one already listed (planning zones are often split into
  // several identical polygons).
  const seen = new Set<string>();
  const visibleItems = items.filter((it) => {
    if (!it.heading && it.fields.length === 0) return false;
    const signature = JSON.stringify([it.heading, it.group, it.fields]);
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
  const count = visibleItems.length;

  const note = NOTE_PANEL_KEYS.has(panel.key) ? panel.note : undefined;
  const insight = insightFor?.(rawItems, panel.note);
  return {
    key: panel.key,
    title,
    state: count > 0 ? "ok" : "empty",
    count,
    countLabel:
      count > 0 && !SINGLE_RECORD_PANEL_KEYS.has(panel.key)
        ? ltCount(count, COUNT_NOUNS[panel.key] ?? DEFAULT_COUNT_NOUN)
        : undefined,
    // A plain "nothing found" carries no message: the report gathers those
    // panels into one "Nerasta: …" line.
    message: count === 0 ? (insight ?? note) : undefined,
    compact: count > 1 && Object.values(rules).some((rule) => rule.inRow),
    insight: count > 0 ? insight : undefined,
    note: count > 0 ? note : undefined,
    items: visibleItems,
    source: sourceWithDate,
  };
}

export function curateReport(report: ParcelReport, pending: ReadonlySet<string> = new Set()): CuratedCategory[] {
  const byKey = new Map<string, ParcelReport["reportPanels"][number]>();
  for (const panel of report.reportPanels) {
    if (HIDDEN_PANEL_KEYS.has(panel.key)) continue;
    byKey.set(panel.key, panel);
  }

  const knownNames: KnownNames = new Map(
    [...byKey].map(([key, panel]) => [
      key,
      (panel.items as RawItem[]).map((item) => item.name).filter((name): name is string => typeof name === "string"),
    ]),
  );

  return CATEGORIES.map((cat) => ({
    id: cat.id,
    title: cat.title,
    panels: cat.panelKeys
      .map((k) => byKey.get(k))
      .filter((p): p is ParcelReport["reportPanels"][number] => Boolean(p))
      .map((panel) => curatePanel(panel, knownNames)),
    pending: cat.panelKeys.filter((k) => pending.has(k)).map((key) => ({ key, title: panelTitle(key) })),
  })).filter((cat) => cat.panels.length > 0 || cat.pending.length > 0);
}

// ---------------------------------------------------------------------------
// Summary ("Santrauka") — the few facts an elderly reader actually came for.
// Derived from the raw panels; never hand-duplicated.
// ---------------------------------------------------------------------------

// `hints` explain the value (how it was measured, what is allowed); the card
// keeps them behind an info tip. `meter` sets the value against an allowed
// maximum, drawn as a slim bar.
// `primary` facts lead the card in large type; the rest follow in a plain
// grid. `failedPanel` names the source of a fact that failed, so the card
// can offer to ask it again.
export type FactMeter = { value: number; max: number; label: string };
export type SummaryFact = {
  label: string;
  value: string;
  hints?: string[];
  meter?: FactMeter;
  primary?: boolean;
  failedPanel?: ReportPanelKey;
};

// good = nothing to worry about, attention = worth a closer look, check = this
// report cannot tell, look it up elsewhere.
export type FlagState = "good" | "attention" | "check";
export type SummaryFlag = {
  label: string;
  state: FlagState;
  detail: string; // the answer in a word or two: "Rasta", "Daugiau nei aplink"
  note?: string; // the longer answer, shown on hover; the panel has it in full
  panelKey?: string; // the detailed panel this flag jumps to when clicked
  tag?: string; // the worry in two or three words, for the tags under the address
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
// never "Nerasta": a clean answer must come from a source that actually answered.
// No count: the panel's row gives it, after repeated records are dropped.
const PRESENCE_FLAGS = [
  { key: "geoportal-constraints", label: "Saugomos teritorijos", tag: "Saugoma teritorija" },
  { key: "kvr-heritage", label: "Kultūros paveldas", tag: "Kultūros paveldas" },
  { key: "szns-restrictions", label: "Specialiosios naudojimo sąlygos", tag: "Specialiosios sąlygos" },
  { key: "osp-pollution-risks", label: "Taršos rizika", tag: "Taršos židinys" },
];

function presenceFlag(
  report: ParcelReport,
  pending: ReadonlySet<string>,
  { key, label, tag }: { key: string; label: string; tag: string },
): SummaryFlag {
  if (pending.has(key)) return { label, state: "check", detail: "Tikrinama…", panelKey: key };
  const panel = findPanel(report, key);
  if (!panel || panel.status !== "ok") {
    return { label, state: "check", detail: "Nepavyko patikrinti", panelKey: key, tag: `${label}: nepatikrinta` };
  }
  const count = panel.items.length;
  return {
    label,
    state: count > 0 ? "attention" : "good",
    detail: count > 0 ? "Rasta" : "Nerasta",
    panelKey: key,
    tag,
  };
}

const formatM2 = (m2: number) => `${Math.round(m2).toLocaleString("lt-LT")}\u00a0m²`;
const formatPct = (pct: number) => `${pct.toLocaleString("lt-LT", { maximumFractionDigits: 1 })}\u00a0%`;

// Užstatymas: how much of the parcel is built on and how much floor area stands
// on it. One figure leads: our building footprints, the same ones the map and
// the "Pastatai" panel show. SSVA's density also counts roofed structures
// (carports, canopies), so where it is noticeably larger it is given as a
// second line rather than a rival number. Without footprints, SSVA leads.
// Where the planning regulation sets a maximum density or intensity, the
// allowed amount is shown alongside, so an owner sees how much more may be built.
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

  const densityPct = num(ssva?.densityPct);
  const roofedM2 = densityPct ? (densityPct / 100) * parcelM2 : undefined;
  const footprintM2 =
    buildings && buildings.length > 0
      ? buildings.reduce((sum, b) => sum + (b.areaSqM ?? polygonAreaM2(b.geometry.coordinates)), 0)
      : undefined;
  const builtM2 = footprintM2 ?? roofedM2;
  const share = (m2: number) => `${formatM2(m2)} (${formatPct((m2 / parcelM2) * 100)})`;

  const facts: SummaryFact[] = [];
  if (builtM2) {
    const builtPct = (builtM2 / parcelM2) * 100;
    const hints: string[] = [];
    if (footprintM2 && roofedM2 && roofedM2 > footprintM2 * 1.05) {
      hints.push(`Skaičiuojama pagal pastatų kontūrus; su stoginėmis ≈ ${share(roofedM2)}.`);
    }
    if (allowedPct) hints.unshift(`Reglamentas leidžia užstatyti iki ${formatPct(allowedPct)} sklypo.`);
    facts.push({
      label: "Užstatytas plotas",
      value: `≈ ${share(builtM2)}`,
      hints,
      primary: true,
      meter: allowedPct
        ? { value: builtPct, max: allowedPct, label: `${formatPct(builtPct)} iš leidžiamų ${formatPct(allowedPct)}` }
        : undefined,
    });
  }
  const intensity = num(ssva?.intensity);
  if (intensity) {
    // Floor area can be smaller than the built-up area: it counts the
    // registered floors only, without carports and terraces.
    const floorM2 = intensity * parcelM2;
    const allowedM2 = allowedIntensity ? allowedIntensity * parcelM2 : undefined;
    facts.push({
      label: "Pastatų bendrasis plotas",
      value: `≈ ${formatM2(floorM2)}`,
      hints: [
        "Registruotas visų aukštų plotas, be stoginių ir terasų.",
        ...(allowedM2 ? [`Reglamentas leidžia iki ≈ ${formatM2(allowedM2)}.`] : []),
      ],
      meter: allowedM2
        ? { value: floorM2, max: allowedM2, label: `${formatM2(floorM2)} iš leidžiamų ≈ ${formatM2(allowedM2)}` }
        : undefined,
    });
  }
  return facts;
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

// `pending`: panels still on their way while the report is built; their
// flags say so instead of "Nepavyko patikrinti".
export function buildSummary(report: ParcelReport, pending: ReadonlySet<string> = new Set()): ReportSummary {
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
      primary: true,
    });
  }

  const polygons = parcelPolygons(report);
  if (polygons.length > 0) {
    facts.push({ label: "Perimetras", value: `${Math.round(perimeterM(polygons)).toLocaleString("lt-LT")} m` });
  }

  // Paskirtis — BIIP's purpose name ("Kita"), with the code the planning
  // documents use for it and its full name. landPurpose is BIIP's group name
  // ("Žemės naudojimo"), never a value, so it is not a fallback.
  const purpose = boundary?.landUse;
  if (typeof purpose === "string" && !isNoiseValue(purpose)) {
    const known = landPurposeByName(purpose);
    facts.push({
      label: "Paskirtis",
      value: describeLandPurpose(purpose),
      hints: known ? [known.full] : undefined,
      primary: true,
    });
  }

  // Pastatų skaičius — footprints inside the parcel are the most trustworthy count.
  // No footprint list at all (an older report) falls back to the OSP count.
  const buildings = report.buildings ? buildingsInParcel(report) : undefined;
  const buildingCount =
    buildings?.length ??
    (typeof ospSummary?.buildingsCount === "number"
      ? ospSummary.buildingsCount
      : undefined);
  if (buildingCount != null) {
    facts.push({
      label: "Pastatai sklype",
      value: buildingCount === 0 ? "Nėra" : `${buildingCount}`,
      primary: true,
    });
  }

  facts.push(...builtUpFacts(report, areaHa, buildings));

  // Vidutinė rinkos vertė — RC mass valuation (registrucentras.lt masvert). A
  // buyer's first question, so a failed lookup stays on the card with a way to
  // ask again instead of silently dropping out.
  const valuation = findPanel(report, "rc-masvert");
  const marketValue = firstItem(report, "rc-masvert")?.marketValueEur;
  if (typeof marketValue === "number" && marketValue > 0) {
    facts.push({
      label: "Vidutinė rinkos vertė",
      value: `${marketValue.toLocaleString("lt-LT")} €`,
    });
  } else if (valuation?.status === "error") {
    facts.push({ label: "Vidutinė rinkos vertė", value: "Nepavyko gauti", failedPanel: "rc-masvert" });
  }

  // Flags — the answers a buyer/owner worries about, each with its tone.
  const flags: SummaryFlag[] = [];

  for (const presence of PRESENCE_FLAGS) flags.push(presenceFlag(report, pending, presence));

  // Building documents: unauthorised construction or binding orders first;
  // otherwise what the valid documents add up to. Nothing is said when there
  // are no documents: the registry covers electronic records only, so absence
  // is no proof of either a clean or a troubled past.
  const permits = findPanel(report, "osp-building-permits");
  if (permits?.status === "ok") {
    const permitItems = permits.items as RawItem[];
    const violations = permitItems.filter((item) => permitStage(item) === "violation").length;
    const verdict = permitVerdict(permitItems);
    if (violations > 0) {
      flags.push({
        label: "Statybos dokumentai",
        state: "attention",
        detail: `Pažeidimų: ${violations}`,
        panelKey: "osp-building-permits",
        tag: "Statybos pažeidimai",
      });
    } else if (verdict) {
      flags.push({
        label: "Statybos dokumentai",
        state: verdict.state,
        detail: verdict.completed ? "Užbaigta" : "Neužbaigta",
        note: verdict.text,
        panelKey: "osp-building-permits",
        tag: "Statybos užbaigimas neįformintas",
      });
    }
  }

  const floodPanel = findPanel(report, "flood-risk");
  if (floodPanel?.status === "ok") {
    const floodCount = floodPanel.items.length;
    flags.push({
      label: "Potvynių rizika",
      state: floodCount > 0 ? "attention" : "good",
      detail: floodCount > 0 ? "Rizikos zona" : "Nerasta",
      panelKey: "flood-risk",
      tag: "Potvynių zona",
    });
  }

  // Crime — the full-year item carries the comparison with the surroundings.
  // The server's level keeps quiet village cells "good" even when they sit
  // above an empty-field average; the words give the actual numbers.
  const crimePanel = findPanel(report, "crime-stats");
  const crimeYear = crimePanel?.status === "ok"
    ? (crimePanel.items as RawItem[]).find((item) => typeof item.comparison === "string")
    : undefined;
  if (crimeYear) {
    const level = crimeYear.comparisonLevel;
    const count = num(crimeYear.allCrimes);
    const average = num(crimeYear.areaAveragePerKm2);
    flags.push({
      label: `Nusikalstamumas, ${String(crimeYear.period).replace(/ m\.$/, "\u00a0m.")}`,
      state: level === "higher" ? "attention" : level === "lower" ? "good" : "check",
      detail: level === "higher" ? "Daugiau nei aplink" : level === "lower" ? "Mažiau nei aplink" : "Panašiai kaip aplink",
      note: count !== undefined && average !== undefined
        ? describeCrimeComparison(count, average)
        : String(crimeYear.comparison),
      panelKey: "crime-stats",
      tag: level === "higher" ? "Daugiau nusikaltimų nei aplink" : "Nusikalstamumas: vidutinis",
    });
  }

  // Šviesolaidis — fibre in the surrounding 1 km² cell. Its absence is worth a
  // look for anyone working from home, so it is said with what there is instead.
  const broadbandPanel = findPanel(report, "broadband");
  if (broadbandPanel?.status === "ok") {
    const technologies = broadbandPanel.items as RawItem[];
    const hasFibre = technologies.some((item) => String(item.technology).startsWith("Šviesolaidis"));
    // "Telefono linija (DSL)" → "telefono linija (DSL)": mid-sentence, with
    // the abbreviation left alone.
    const others = technologies.map((item) => {
      const name = String(item.technology);
      return name.charAt(0).toLowerCase() + name.slice(1);
    });
    flags.push({
      label: "Šviesolaidinis internetas aplinkui",
      state: hasFibre ? "good" : technologies.length > 0 ? "attention" : "check",
      detail: hasFibre ? "Yra" : technologies.length > 0 ? "Nėra" : "Nėra duomenų",
      note: !hasFibre && technologies.length > 0 ? `Yra tik ${others.join(", ")}.` : undefined,
      panelKey: "broadband",
      tag: technologies.length > 0 ? "Nėra šviesolaidžio" : "Internetas: nėra duomenų",
    });
  }

  return { facts, flags };
}
