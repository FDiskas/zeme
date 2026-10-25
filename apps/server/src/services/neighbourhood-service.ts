import type { UpstreamPanel } from "./connectors";
import { parcelCentre } from "./geometry";

// Neighbourhood context — what surrounds the parcel rather than the parcel
// itself: nearest schools / kindergartens / health facilities, registered crime
// in the surrounding 1 km grid cell, and flood-risk overlap. All three sources
// are keyless ArcGIS REST services queried live per report.

const IRD_NVZR = "https://maps.ird.lt/server/rest/services/NVZRGIS";
const EDUCATION_LAYER = `${IRD_NVZR}/UGDYMOISTAIGOS/FeatureServer/0`;
// Gardeles layer ids: 0=100m, 1=250m, 2=500m, 3=1km, 4=2.5km, 5=5km, 6=10km.
const CRIME_GRID_1KM = `${IRD_NVZR}/Gardeles/FeatureServer/3`;
const CRIME_GRID_5KM = `${IRD_NVZR}/Gardeles/FeatureServer/5`;
const CRIME_GRID_10KM = `${IRD_NVZR}/Gardeles/FeatureServer/6`;
const HEALTH_LAYER =
  "https://osp-sdg.stat.gov.lt/arcgis/rest/services/Hosted/Gydymo_%C4%AFstaigos/FeatureServer/0";
// Aplinkos ministerija flood-risk map: 100 m grid cells where a modelled flood
// reaches economic assets. 0 = river (snowmelt & rain), 1 = coastal.
const FLOOD_RISK_SERVICE =
  "https://services-eu1.arcgis.com/1cGVU2oTHcyk0zN5/arcgis/rest/services/Rizika/FeatureServer";

// Search radii tried in order until something is found — a city parcel hits
// on the first, a remote farmstead may need the last.
const SEARCH_RADII_M = [3000, 15000, 50000];

type LonLat = [number, number];

async function queryLayer(layerUrl: string, params: Record<string, string>): Promise<any[]> {
  const data = await arcgisQuery(layerUrl, params);
  return data.features || [];
}

async function arcgisQuery(layerUrl: string, params: Record<string, string>): Promise<any> {
  const response = await fetch(`${layerUrl}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ f: "json", ...params }).toString(),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    throw new Error(`HTTP error ${response.status} from ArcGIS service`);
  }
  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.message || "ArcGIS query error");
  }
  return data;
}

function pointParams(centre: LonLat): Record<string, string> {
  return {
    geometry: `${centre[0]},${centre[1]}`,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
  };
}

function haversineKm([lon1, lat1]: LonLat, [lon2, lat2]: LonLat): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

type PlaceDetails = { name: string; type: string; address: string };
type NearbyPlace = PlaceDetails & { distanceKm: number; point: LonLat };

// Nearest features of one layer, widening the search radius until at least one
// is found. Distance is straight-line from the parcel centre.
async function findNearest(
  layerUrl: string,
  centre: LonLat,
  where: string,
  toPlace: (attrs: any) => PlaceDetails | null,
  limit: number,
): Promise<NearbyPlace[]> {
  for (const radius of SEARCH_RADII_M) {
    const features = await queryLayer(layerUrl, {
      ...pointParams(centre),
      distance: String(radius),
      units: "esriSRUnit_Meter",
      where,
      outFields: "*",
      returnGeometry: "true",
      outSR: "4326",
    });

    const places = features
      .map((f: any): NearbyPlace | null => {
        const place = toPlace(f.attributes ?? {});
        const x = f.geometry?.x;
        const y = f.geometry?.y;
        if (!place || typeof x !== "number" || typeof y !== "number") return null;
        return { ...place, distanceKm: haversineKm(centre, [x, y]), point: [x, y] };
      })
      .filter((p): p is NearbyPlace => p !== null)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    if (places.length > 0) return places.slice(0, limit);
  }
  return [];
}

const SCHOOL_TYPES = ["Gimnazija", "Progimnazija", "Pagrindinė mokykla", "Pradinė mokykla"];
const sqlList = (values: string[]) => values.map((v) => `'${v}'`).join(",");

// STATUSAS=1 is an operating institution (2680 of 3073 rows); 0 = closed.
const SCHOOL_WHERE =
  `STATUSAS=1 AND GRUPE='Bendrojo ugdymo mokykla' AND PAGRINDINIS_TIPAS IN (${sqlList(SCHOOL_TYPES)})`;
const KINDERGARTEN_WHERE = "STATUSAS=1 AND PAGRINDINIS_TIPAS='Ikimokyklinio ugdymo mokykla'";

function educationPlace(attrs: any): PlaceDetails | null {
  if (!attrs.PAVADINIMAS) return null;
  return {
    name: String(attrs.PAVADINIMAS),
    type: String(attrs.PAGRINDINIS_TIPAS ?? ""),
    address: String(attrs.ADRESAS ?? ""),
  };
}

// The health layer mixes in public-health bureaus, ambulance stations and the
// health-insurance fund — none is somewhere a resident goes for care.
const NON_CARE_FACILITY = /visuomenės sveikatos|greitosios|ligonių kasa/i;

function healthPlace(attrs: any): PlaceDetails | null {
  if (!attrs.name || NON_CARE_FACILITY.test(attrs.name)) return null;
  // No finer type in this layer; empty is dropped by the UI rather than repeating the category.
  return { name: String(attrs.name), type: "", address: String(attrs.address ?? "") };
}

const roundKm = (km: number) => Math.round(km * 10) / 10;

export async function fetchNearbyServices(geometry: any): Promise<UpstreamPanel> {
  const base: Pick<UpstreamPanel, "key" | "title" | "source"> = {
    key: "nearby-services",
    title: "Artimiausios mokyklos, darželiai ir gydymo įstaigos",
    source: "IRD ugdymo įstaigų sluoksnis (maps.ird.lt), OSP gydymo įstaigos",
  };

  const centre = parcelCentre(geometry);
  if (!centre) {
    return { ...base, status: "error", items: [], note: "Sklypo vieta nežinoma; atstumų apskaičiuoti negalima." };
  }

  const [schools, kindergartens, health] = await Promise.all([
    findNearest(EDUCATION_LAYER, centre, SCHOOL_WHERE, educationPlace, 3).catch(() => null),
    findNearest(EDUCATION_LAYER, centre, KINDERGARTEN_WHERE, educationPlace, 2).catch(() => null),
    findNearest(HEALTH_LAYER, centre, "1=1", healthPlace, 2).catch(() => null),
  ]);

  if (!schools && !kindergartens && !health) {
    return { ...base, status: "error", items: [], note: "Nepavyko gauti duomenų apie aplinkinius objektus." };
  }

  const toItems = (category: string, places: NearbyPlace[] | null) =>
    (places ?? []).map((p) => ({
      category,
      name: p.name,
      type: p.type,
      address: p.address,
      distanceKm: roundKm(p.distanceKm),
      // Lets the UI link the address to the parcel the place stands on.
      lng: p.point[0],
      lat: p.point[1],
    }));

  const items = [
    ...toItems("Mokykla", schools),
    ...toItems("Darželis", kindergartens),
    ...toItems("Gydymo įstaiga", health),
  ];

  return {
    ...base,
    status: schools && kindergartens && health ? "ok" : "partial",
    items,
    note: "Atstumas skaičiuojamas tiesia linija nuo sklypo centro.",
  };
}

type CrimeRow = { year: number; period: string; all: number; thefts: number; violent: number };

function crimeRows(features: any[]): CrimeRow[] {
  return features.map((f: any) => ({
    year: Number(f.attributes.METAI),
    period: String(f.attributes.PERIOD),
    all: Number(f.attributes.VISI) || 0,
    thefts: Number(f.attributes.VAG) || 0,
    violent: Number(f.attributes.NSG) || 0,
  }));
}

const CRIME_FIELDS = "METAI,PERIOD,VISI,VAG,NSG";

// Grid cells only have rows for years with at least one registered crime, so
// the newest published year/half-year comes from the whole (10 km) layer — a
// quiet cell then honestly reads as zero instead of falling back to a stale year.
async function latestCrimePeriods(): Promise<{ fullYear?: number; halfYear?: number }> {
  const features = await queryLayer(CRIME_GRID_10KM, {
    where: "1=1",
    groupByFieldsForStatistics: "PERIOD",
    outStatistics: JSON.stringify([
      { statisticType: "max", onStatisticField: "METAI", outStatisticFieldName: "maxYear" },
    ]),
  });
  const maxYear = (period: string) => {
    const attrs = features.find((f: any) => f.attributes.PERIOD === period)?.attributes;
    // ArcGIS upper-cases the alias on this server; accept either spelling.
    const value = attrs?.MAXYEAR ?? attrs?.maxYear;
    return value == null ? undefined : Number(value);
  };
  return { fullYear: maxYear("M"), halfYear: maxYear("I") };
}

// Below this many crimes a year in a 1 km² cell the area is called quiet
// outright: comparing a village cell with the empty fields around it would
// otherwise always read as "above average".
const LOW_CRIME_PER_YEAR = 20;

function compareWithArea(cellCount: number, areaAveragePerKm2: number) {
  if (cellCount < LOW_CRIME_PER_YEAR) {
    return { comparison: `Mažas (iki ${LOW_CRIME_PER_YEAR} veikų per metus)`, comparisonLevel: "lower" };
  }
  const ratio = cellCount / Math.max(areaAveragePerKm2, 1);
  if (ratio < 0.75) return { comparison: "Mažiau nei apylinkių vidurkis", comparisonLevel: "lower" };
  if (ratio > 1.25) return { comparison: "Daugiau nei apylinkių vidurkis", comparisonLevel: "higher" };
  return { comparison: "Panašiai kaip apylinkių vidurkis", comparisonLevel: "similar" };
}

// Registered crime for the 1 km grid cell the parcel sits in, compared with the
// per-km² average of the surrounding 5×5 km cell. Smaller cells are available
// but carry single-digit counts that mislead more than they inform.
export async function fetchCrimeStats(geometry: any): Promise<UpstreamPanel> {
  const base: Pick<UpstreamPanel, "key" | "title" | "source"> = {
    key: "crime-stats",
    title: "Užregistruotos nusikalstamos veikos aplinkoje",
    source: "IRD Nusikalstamų veikų žinybinis registras (maps.ird.lt NVZRGIS)",
  };

  const centre = parcelCentre(geometry);
  if (!centre) {
    return { ...base, status: "error", items: [], note: "Sklypo vieta nežinoma; nusikalstamumo duomenų parinkti negalima." };
  }

  try {
    const [periods, cellFeatures, areaFeatures] = await Promise.all([
      latestCrimePeriods(),
      queryLayer(CRIME_GRID_1KM, { ...pointParams(centre), where: "1=1", outFields: CRIME_FIELDS, returnGeometry: "false" }),
      queryLayer(CRIME_GRID_5KM, { ...pointParams(centre), where: "PERIOD='M'", outFields: CRIME_FIELDS, returnGeometry: "false" }),
    ]);

    const latestYear = periods.fullYear;
    if (latestYear == null) {
      return { ...base, status: "error", items: [], note: "Nepavyko nustatyti naujausių nusikalstamumo duomenų laikotarpio." };
    }

    const cell = crimeRows(cellFeatures);
    const area = crimeRows(areaFeatures);
    const zero = (year: number, period: string): CrimeRow => ({ year, period, all: 0, thefts: 0, violent: 0 });
    const cellRow = (year: number, period: string) =>
      cell.find((r) => r.year === year && r.period === period) ?? zero(year, period);
    const counts = (r: CrimeRow) => ({ allCrimes: r.all, thefts: r.thefts, violentCrimes: r.violent });

    const latest = cellRow(latestYear, "M");
    const areaLatest = area.find((r) => r.year === latestYear) ?? zero(latestYear, "M");
    // The 5 km cell covers 25 km²; the parcel's own cell is 1 km².
    const areaAveragePerKm2 = Math.round((areaLatest.all / 25) * 10) / 10;

    const items: Record<string, unknown>[] = [];
    if (periods.halfYear != null && periods.halfYear > latestYear) {
      items.push({ period: `${periods.halfYear} m. I pusmetis`, ...counts(cellRow(periods.halfYear, "I")) });
    }
    items.push({
      period: `${latestYear} m.`,
      ...counts(latest),
      areaAveragePerKm2,
      ...compareWithArea(latest.all, areaAveragePerKm2),
    });
    items.push({ period: `${latestYear - 1} m.`, ...counts(cellRow(latestYear - 1, "M")) });

    return {
      ...base,
      status: "ok",
      items,
      note: "Skaičiai – 1×1 km kvadratui, kuriame yra sklypas. Apylinkių vidurkis – 5×5 km kvadrato vidurkis vienam km².",
    };
  } catch (err: any) {
    return {
      ...base,
      status: "error",
      items: [],
      note: `Klaida gaunant nusikalstamumo duomenis: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// Whether the parcel touches a cell of the national flood-risk map. The
// service's numeric fields are undocumented (one is just a grid code), so only
// the overlap itself is reported — the exact flood extent and probability are
// left to the official map, linked from the panel.
export async function fetchFloodRisk(geometry: any): Promise<UpstreamPanel> {
  const base: Pick<UpstreamPanel, "key" | "title" | "source"> = {
    key: "flood-risk",
    title: "Potvynių rizika",
    source: "Aplinkos ministerija, potvynių grėsmės ir rizikos žemėlapiai",
  };

  const rings =
    geometry?.type === "Polygon" ? geometry.coordinates
      : geometry?.type === "MultiPolygon" ? geometry.coordinates.flat()
        : undefined;
  if (!rings || rings.length === 0 || (rings[0]?.length ?? 0) < 4) {
    return { ...base, status: "error", items: [], note: "Sklypo ribos nežinomos; potvynių rizikos patikrinti negalima." };
  }

  const params = {
    geometry: JSON.stringify({ rings, spatialReference: { wkid: 4326 } }),
    geometryType: "esriGeometryPolygon",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    where: "1=1",
    returnCountOnly: "true",
  };

  const countCells = async (layerId: number): Promise<number> =>
    Number((await arcgisQuery(`${FLOOD_RISK_SERVICE}/${layerId}`, params)).count) || 0;

  try {
    const [riverCells, coastalCells] = await Promise.all([countCells(0), countCells(1)]);
    const items = [
      ...(riverCells > 0 ? [{ floodType: "Upių potvynis (sniego tirpsmas, liūtys)", link: "https://potvyniai.aplinka.lt" }] : []),
      ...(coastalCells > 0 ? [{ floodType: "Priekrantės potvynis (jūra, Kuršių marios)", link: "https://potvyniai.aplinka.lt" }] : []),
    ];
    return {
      ...base,
      status: "ok",
      items,
      note: items.length === 0
        ? "Sklypas nepatenka į potvynių rizikos žemėlapio teritoriją."
        : "Sklypas ar jo dalis patenka į potvynių rizikos žemėlapio 100×100 m gardelę. Tikslias užliejimo ribas ir tikimybę tikrinkite potvyniai.aplinka.lt žemėlapyje.",
    };
  } catch (err: any) {
    return {
      ...base,
      status: "error",
      items: [],
      note: `Klaida tikrinant potvynių riziką: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
