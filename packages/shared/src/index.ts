import { z } from "zod";

export const parcelAutocompleteInputSchema = z.object({
  query: z.string().min(2).max(120),
});

export const parcelLookupInputSchema = z.object({
  cadastralRegNo: z.string().min(3).max(64),
  forceRefresh: z.boolean().optional().default(false),
});

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

export const parcelReportSchema = z.object({
  cadastralRegNo: z.string(),
  address: z.string(),
  coordinates: geometrySchema,
  buildings: z.array(buildingFootprintSchema).optional(),
  fetchedAt: z.string(),
  cached: z.boolean(),
  cacheAgeDays: z.number().optional(),
  sources: z.array(z.string()),
  reportPanels: z.array(reportPanelSchema),
  pdfUrl: z.string().optional(),
});

export type ParcelSearchItem = z.infer<typeof parcelSearchItemSchema>;
export type BuildingFootprint = z.infer<typeof buildingFootprintSchema>;
export type ParcelReport = z.infer<typeof parcelReportSchema>;
