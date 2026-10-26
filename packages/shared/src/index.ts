import { z } from "zod";

export const parcelAutocompleteInputSchema = z.object({
  query: z.string().min(2).max(120),
});

export const parcelLookupInputSchema = z.object({
  cadastralRegNo: z.string().min(3).max(64),
  forceRefresh: z.boolean().optional().default(false),
});

// Reverse lookup: which parcel sits under a clicked map coordinate (WGS84).
export const parcelPointInputSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});

// Bounding-box query: all parcel outlines visible in the current map viewport.
export const parcelBboxInputSchema = z.object({
  minLat: z.number().min(-90).max(90),
  minLng: z.number().min(-180).max(180),
  maxLat: z.number().min(-90).max(90),
  maxLng: z.number().min(-180).max(180),
});

// Null when no parcel covers the point (e.g. a road, water, or outside coverage).
export const parcelPointResolutionSchema = z
  .object({ cadastralRegNo: z.string() })
  .nullable();

export const parcelSearchItemSchema = z.object({
  cadastralRegNo: z.string(),
  address: z.string().optional(),
  center: z.tuple([z.number(), z.number()]).optional(),
});

export const geometrySchema = z.object({
  type: z.enum(["Polygon", "MultiPolygon"]),
  coordinates: z.array(z.array(z.array(z.number()))),
});

export const buildingFootprintSchema = z.object({
  geometry: geometrySchema,
  areaSqM: z.number().optional(),
  purposeCode: z.string().optional(),
  // Enriched via spatial join (point-in-polygon) with BIIP address points / OSP registry.
  address: z.string().optional(),
  constructionYear: z.number().optional(),
  floors: z.number().optional(),
  apartments: z.number().optional(),
});

export const reportPanelSchema = z.object({
  key: z.string(),
  title: z.string(),
  status: z.enum(["ok", "partial", "error"]),
  source: z.string(),
  items: z.array(z.record(z.string(), z.unknown())),
  note: z.string().optional(),
});

// Adjacent parcels around the subject parcel — drawn grey on the map and
// clickable to load that parcel's own report. Only identity + outline needed.
export const neighborParcelSchema = z.object({
  cadastralRegNo: z.string(),
  geometry: geometrySchema,
});

export const parcelReportSchema = z.object({
  cadastralRegNo: z.string(),
  address: z.string(),
  // True only when `address` is a resolved street address. False/absent means the
  // parcel has no street address (e.g. rural land) — `address` is then an
  // administrative-area label or empty, and the UI shows the parcel-centre
  // coordinates instead. Never carries a fabricated address.
  hasStreetAddress: z.boolean().optional(),
  // Only for parcels without a street address: the administrative locality the
  // parcel lies in ("Vilniaus r. sav., Rudaminos sen., Kalviškių k."), so the
  // reader still learns where it is. Resolved from registry boundaries.
  locality: z.string().optional(),
  coordinates: geometrySchema,
  buildings: z.array(buildingFootprintSchema).optional(),
  neighbors: z.array(neighborParcelSchema).optional(),
  fetchedAt: z.string(),
  cached: z.boolean(),
  cacheAgeDays: z.number().optional(),
  sources: z.array(z.string()),
  reportPanels: z.array(reportPanelSchema),
  pdfUrl: z.string().optional(),
});

export const parcelPdfInputSchema = z.object({
  cadastralRegNo: z.string().min(3).max(64),
});

export const parcelPdfOutputSchema = z.object({
  pdfUrl: z.string(),
});

// One NŽT orthophoto series on geoportal.lt: the ArcGIS service name and the
// years it was flown ("1995-2001", "2015"), or "Naujausia" for the newest.
export const orthoSeriesSchema = z.object({
  service: z.string(),
  label: z.string(),
});

// The series as published when this list was written, oldest first. Used until
// the live list arrives, and whenever geoportal.lt cannot be reached.
export const ORTHO_SERIES_FALLBACK: OrthoSeries[] = [
  { service: "ORT10LT_1995_2001", label: "1995-2001" },
  { service: "ORT10LT_2005_2006", label: "2005-2006" },
  { service: "ORT10LT_2009_2010", label: "2009-2010" },
  { service: "ORT10LT_2012_2013", label: "2012-2013" },
  { service: "ORT10LT_2015", label: "2015" },
  { service: "ORT10LT_2018_2020", label: "2018-2020" },
  { service: "ORT10LT_2021_2023", label: "2021-2023" },
  { service: "ORT10LT_2024_2026", label: "2024-2026" },
  { service: "ORT10LT_Web_Mercator_102100", label: "Naujausia" },
];

// Lithuanian counts take one of three noun forms: 1 įrašas, 2 įrašai, 10 įrašų.
export function ltCount(n: number, [one, few, many]: readonly [string, string, string]): string {
  const tens = n % 100;
  const units = n % 10;
  const form = tens >= 11 && tens <= 19 ? many : units === 1 ? one : units >= 2 ? few : many;
  return `${n.toLocaleString("lt-LT")} ${form}`;
}

const formatDecimal = (n: number) => n.toLocaleString("lt-LT", { maximumFractionDigits: 1 });

// "3 veikos – ~2,5 karto mažiau nei apylinkių vidurkis (7,4)": the parcel's
// 1 km² cell against the per-km² average of the 5×5 km around it. Shared, so
// the web report and the PDF word it the same way.
export function describeCrimeComparison(count: number, areaAverage: number): string {
  const crimes = ltCount(count, ["veika", "veikos", "veikų"]);
  const average = `apylinkių vidurkis (${formatDecimal(areaAverage)})`;
  if (count === 0) return `${crimes}; ${average}`;
  const ratio = count / Math.max(areaAverage, 0.1);
  const times = (r: number) => {
    const rounded = Math.round(r * 10) / 10;
    return Number.isInteger(rounded) ? ltCount(rounded, ["kartą", "kartus", "kartų"]) : `${formatDecimal(rounded)} karto`;
  };
  if (ratio < 0.75) return `${crimes} – ~${times(1 / ratio)} mažiau nei ${average}`;
  if (ratio > 1.25) return `${crimes} – ~${times(ratio)} daugiau nei ${average}`;
  return `${crimes} – panašiai kaip ${average}`;
}

export type OrthoSeries = z.infer<typeof orthoSeriesSchema>;
export type ParcelSearchItem = z.infer<typeof parcelSearchItemSchema>;
export type BuildingFootprint = z.infer<typeof buildingFootprintSchema>;
export type NeighborParcel = z.infer<typeof neighborParcelSchema>;
export type ParcelReport = z.infer<typeof parcelReportSchema>;
export type ParcelPdfOutput = z.infer<typeof parcelPdfOutputSchema>;
