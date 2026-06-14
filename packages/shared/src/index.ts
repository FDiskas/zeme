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

export type ParcelSearchItem = z.infer<typeof parcelSearchItemSchema>;
export type BuildingFootprint = z.infer<typeof buildingFootprintSchema>;
export type NeighborParcel = z.infer<typeof neighborParcelSchema>;
export type ParcelReport = z.infer<typeof parcelReportSchema>;
export type ParcelPdfOutput = z.infer<typeof parcelPdfOutputSchema>;
