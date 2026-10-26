import { ORTHO_SERIES_FALLBACK, type OrthoSeries } from "@zeme/shared";

// NŽT publishes each orthophoto flight series as its own ArcGIS service in the
// geoportal.lt NZT folder (ORT10LT_1995_2001 … ORT10LT_2024_2026), and keeps
// the newest flights in a cached web-mercator service. The folder listing is
// read here, so a new series shows up on the map's year slider without a code
// change.
const NZT_FOLDER_URL = "https://www.geoportal.lt/arcgis/rest/services/NZT?f=json";
const LATEST_SERVICE = "ORT10LT_Web_Mercator_102100";
const SERIES_NAME = /^NZT\/(ORT10LT_(\d{4})(?:_(\d{4}))?)$/;
const CACHE_MS = 24 * 60 * 60 * 1000;

type FolderListing = { services?: { name?: string; type?: string }[] };

let cached: { series: OrthoSeries[]; at: number } | null = null;

// The dated series, oldest first, then "Naujausia".
export function parseOrthoSeries(listing: FolderListing): OrthoSeries[] {
  const services = (listing.services ?? []).filter((s) => s.type === "MapServer" && typeof s.name === "string");

  const dated = services
    .map((s) => SERIES_NAME.exec(s.name!))
    .filter((match): match is RegExpExecArray => match !== null)
    .map(([, service, from, to]) => ({
      service: service!,
      from: Number(from),
      label: to ? `${from}-${to}` : from!,
    }))
    .sort((a, b) => a.from - b.from)
    .map(({ service, label }) => ({ service, label }));

  const hasLatest = services.some((s) => s.name === `NZT/${LATEST_SERVICE}`);
  if (hasLatest) return [...dated, { service: LATEST_SERVICE, label: "Naujausia" }];

  // Without the cached newest layer, the newest dated series stands in for it.
  if (dated.length === 0) return [];
  return [...dated.slice(0, -1), { ...dated[dated.length - 1]!, label: "Naujausia" }];
}

/**
 * The orthophoto series to offer on the map, refreshed once a day. When
 * geoportal.lt is unreachable or answers with nothing usable, the last good
 * list is kept, or the bundled one before any list has been read.
 */
export async function listOrthoSeries(): Promise<OrthoSeries[]> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.series;

  try {
    const response = await fetch(NZT_FOLDER_URL, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    // geoportal answers JSON as text/plain, so parse the body ourselves.
    const series = parseOrthoSeries(JSON.parse(await response.text()) as FolderListing);
    if (series.length < 2) throw new Error("no orthophoto series in the NZT folder");
    cached = { series, at: Date.now() };
    return series;
  } catch (error) {
    console.warn("[Ortho] Could not read the geoportal.lt series list:", error instanceof Error ? error.message : error);
    return cached?.series ?? ORTHO_SERIES_FALLBACK;
  }
}
