import { ltCount } from "@zeme/shared";
import type { UpstreamPanel } from "./connectors";
import { describeUpstreamError } from "./upstream-error";

// Building energy-performance certificates (SSVA), open on data.gov.lt. They
// carry no building number and no coordinates, only the address as the
// certifier typed it ("Galinės 8, Galinės, Vilniaus r. sav." for the
// registry's "Galinės g. 8, Galinės k."), so each of the parcel's address
// points is matched by street, house number and municipality.
const CERTIFICATE_MODEL = "https://get.data.gov.lt/datasets/gov/ssva/pen_sertifikatai/Sertifikatas";

// Street and settlement type words, dropped before comparing names; so are
// initials ("A. Mickevičiaus g." → "mickevičiaus").
const NAME_TYPE_WORDS = new Set([
  "g", "gatvė", "al", "alėja", "pr", "prospektas", "a", "aikštė", "tak", "takas",
  "skg", "skersgatvis", "kel", "kelias", "pl", "plentas", "krant", "krantinė",
  "aklg", "aklagatvis", "k", "km", "kaimas", "mstl", "miestelis", "vs", "viensėdis",
  "m", "miestas", "sen", "seniūnija",
]);

function nameWords(name: string): string[] {
  return name
    .toLocaleLowerCase("lt")
    .split(/[\s.]+/)
    .filter((word) => word.length > 1 && !NAME_TYPE_WORDS.has(word));
}

const normalizeName = (name: string) => nameWords(name).join(" ");
const normalizeNumber = (number: string) => number.replace(/\s+/g, "").toLocaleUpperCase("lt");

// "Kaunas" and "Kauno m." are one town: settlements are named in either case,
// so they are compared by their first letters only.
const sameSettlement = (a: string, b: string) => {
  const stemA = normalizeName(a).slice(0, 4);
  return stemA.length > 0 && stemA === normalizeName(b).slice(0, 4);
};

type AddressPoint = {
  municipality: string;
  locality: string;
  // The street, or the village where houses are numbered without one.
  street: string;
  number: string;
  label: string;
};

// The parcel's address points from its "biip-addresses" panel, whose address
// is written by formatAddress (biip-service): "Savivaldybė, Gyvenvietė,
// Gatvė Nr", or "Savivaldybė, Gyvenvietė, Nr" without a street.
export function addressPointsOf(panel: UpstreamPanel | undefined): AddressPoint[] {
  const points: AddressPoint[] = [];
  for (const item of panel?.items ?? []) {
    if (item.type !== "Adreso taškas") continue;
    const address = typeof item.address === "string" ? item.address : "";
    const number = typeof item.plotOrBuildingNumber === "string" ? item.plotOrBuildingNumber.trim() : "";
    const parts = address.split(", ");
    if (!number || parts.length < 2) continue;
    const last = parts.at(-1)!;
    const locality = parts.length >= 3 ? parts.at(-2)! : "";
    const street = last.endsWith(number) ? last.slice(0, -number.length).trim() : "";
    points.push({
      municipality: parts[0]!,
      locality,
      street: street || locality,
      number,
      label: street ? last : `${locality} ${number}`,
    });
  }
  return points;
}

type CertificateRow = {
  nr?: string;
  adresas?: string;
  klase?: string;
  plotas?: number;
  saltiniai?: string | null;
  isdavimas?: string;
  galiojimas?: string;
};

type ParsedAddress = { street: string; number: string; flat?: string; places: string[] };

// "Galinės g. 86-7, Avižienių sen., Galinės k., Vilniaus r. sav.": the street
// and house number come first, a flat after a dash, then the places.
function parseCertificateAddress(address: string): ParsedAddress | null {
  const [first = "", ...places] = address.split(",").map((part) => part.trim());
  const match = /^(.*?)\s*(\d+)\s*(\p{L})?(?:\s*-\s*(\S+))?$/u.exec(first);
  if (!match) return null;
  return {
    street: match[1]!,
    number: normalizeNumber(match[2]! + (match[3] ?? "")),
    flat: match[4],
    places: places.filter((place) => !/\b(sav|sen)\.?$/.test(place)),
  };
}

function matchesPoint(parsed: ParsedAddress, point: AddressPoint): boolean {
  if (parsed.number !== normalizeNumber(point.number)) return false;
  if (normalizeName(parsed.street) !== normalizeName(point.street)) return false;
  // Where the certificate names its settlement, it must be the parcel's.
  return parsed.places.length === 0 || !point.locality || parsed.places.some((place) => sameSettlement(place, point.locality));
}

// "Šil.šaltinis_1: Dujinis katilas; Šil.šaltinis_4: Šilumos siurblys, Šil.įrenginys_1: …"
// → "Dujinis katilas, Šilumos siurblys, …" (the parts are joined by ";" or ",").
function heatSources(text: string | null | undefined): string | undefined {
  const sources = (text ?? "")
    .split(/Šil\.[^:]*:/)
    .map((part) => part.replace(/[;,\s]+$/, "").trim())
    .filter(Boolean);
  return sources.length > 0 ? [...new Set(sources)].join(", ") : undefined;
}

// "B ×8, C ×4": the flats' classes, most common first.
function classTally(rows: CertificateRow[]): string {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const energyClass = row.klase ?? "?";
    counts.set(energyClass, (counts.get(energyClass) ?? 0) + 1);
  }
  return [...counts]
    .sort((a, b) => b[1] - a[1])
    .map(([energyClass, count]) => `${energyClass} ×${count}`)
    .join(", ");
}

// One query per street of the parcel, and at most this many: a block of flats
// can have a dozen entrances on one or two streets.
const MAX_STREET_QUERIES = 5;

// data.gov.lt now and then drops one of a burst of requests (the report asks
// some twenty services at once); a second try nearly always gets through.
async function fetchJsonWithRetry(url: string): Promise<any> {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(`HTTP error ${response.status} from data.gov.lt`);
      return await response.json();
    } catch (err) {
      if (attempt >= 2) throw err;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

async function certificatesOnStreet(point: AddressPoint): Promise<CertificateRow[]> {
  // The longest word of the street name finds every spelling of it.
  const word = point.street.split(/[\s.]+/).sort((a, b) => b.length - a.length)[0] ?? "";
  const filter = [word, point.municipality]
    .map((text) => `adresas.contains(${encodeURIComponent(JSON.stringify(text))})`)
    .join("&");
  const url = `${CERTIFICATE_MODEL}?${filter}&select(nr,adresas,klase,plotas,saltiniai,isdavimas,galiojimas)&limit(5000)&format(json)`;
  return (await fetchJsonWithRetry(url))._data ?? [];
}

export async function fetchEnergyCertificates(points: AddressPoint[]): Promise<UpstreamPanel> {
  const base: Pick<UpstreamPanel, "key" | "title" | "source"> = {
    key: "energy-certificates",
    title: "Pastatų energinis naudingumas",
    source: "Statybos sektoriaus vystymo agentūra (SSVA), data.gov.lt",
  };

  if (points.length === 0) {
    return { ...base, status: "ok", items: [], note: "Sklype nėra adresų, pagal kuriuos būtų galima rasti energinio naudingumo sertifikatus." };
  }

  try {
    const streets = new Map<string, AddressPoint>();
    for (const point of points) streets.set(`${normalizeName(point.street)}|${point.municipality}`, point);
    const rows = (
      await Promise.all([...streets.values()].slice(0, MAX_STREET_QUERIES).map(certificatesOnStreet))
    ).flat();
    const parsedRows = rows
      .map((row) => ({ row, parsed: row.adresas ? parseCertificateAddress(row.adresas) : null }))
      .filter((entry): entry is { row: CertificateRow; parsed: ParsedAddress } => entry.parsed !== null);

    const today = new Date().toISOString().slice(0, 10);
    const seen = new Set<string>();
    const items: Record<string, unknown>[] = [];
    for (const point of points) {
      const key = `${normalizeName(point.street)}|${normalizeNumber(point.number)}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const matched = parsedRows.filter(({ parsed }) => matchesPoint(parsed, point));
      // A certificate number can repeat across versions; the newest issue wins.
      const newestFirst = (list: CertificateRow[]) =>
        [...new Map(list.map((row) => [row.nr, row])).values()].sort((a, b) =>
          (b.isdavimas ?? "").localeCompare(a.isdavimas ?? ""),
        );
      const building = newestFirst(matched.filter(({ parsed }) => !parsed.flat).map(({ row }) => row));
      const flats = newestFirst(matched.filter(({ parsed }) => parsed.flat).map(({ row }) => row));
      if (building.length === 0 && flats.length === 0) continue;

      const newest = building[0];
      items.push({
        address: point.label,
        ...(newest
          ? {
              energyClass: newest.klase,
              status: (newest.galiojimas ?? "") >= today ? "Galioja" : "Nebegalioja",
              validUntil: newest.galiojimas,
              issued: newest.isdavimas,
              certifiedAreaSqM: newest.plotas,
              heating: heatSources(newest.saltiniai),
              certificateNo: newest.nr,
              otherCertificates: building.length > 1 ? building.length - 1 : undefined,
            }
          : {}),
        ...(flats.length > 0 ? { flatCertificates: `${ltCount(flats.length, ["butas", "butai", "butų"])}: ${classTally(flats)}` } : {}),
      });
    }

    return {
      ...base,
      status: "ok",
      items,
      note:
        items.length > 0
          ? "Sertifikatai rasti pagal pastato adresą, nes atviruose duomenyse nėra pastato numerio. Prieš priimdami sprendimą, sertifikatą pasitikrinkite SSVA registre."
          : "Pagal sklypo adresus energinio naudingumo sertifikatų nerasta. Jie privalomi naujiems, parduodamiems ir nuomojamiems pastatams, todėl senesni namai jo dažnai neturi.",
    };
  } catch (err: any) {
    return {
      ...base,
      status: "error",
      items: [],
      note: `Klaida gaunant energinio naudingumo sertifikatus: ${describeUpstreamError(err)}`,
    };
  }
}
