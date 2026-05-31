import { os } from "@orpc/server";
import { prisma } from "./db";
import {
  parcelAutocompleteInputSchema,
  parcelBboxInputSchema,
  parcelLookupInputSchema,
  parcelPointInputSchema,
  parcelPointResolutionSchema,
  parcelReportSchema,
  parcelSearchItemSchema,
  neighborParcelSchema,
} from "@zeme/shared";
import {
  buildUnknownAddress,
  buildComprehensiveReport,
  cacheAgeDays,
  hasUsableGeometry,
  isPlaceholderAddress,
  isCacheFresh,
} from "./services/report-service";
import { resolveParcelByCoordinates } from "./services/biip-service";
import { fetchParcelByPoint, fetchParcelsByBbox } from "./services/osp-service";
import { renderReportPdf } from "./services/pdf";
import { searchAddressAutocomplete } from "./services/autocomplete";

function shouldReuseCachedReport(report: { address: string; reportData: string; updatedAt: Date }): boolean {
  if (!isCacheFresh(report.updatedAt)) return false;

  // If reportData is empty or just a skeleton placeholder like '{}', it is not a real cached report.
  // Return false silently to trigger a fresh build.
  if (!report.reportData || report.reportData === "{}") {
    return false;
  }

  try {
    const parsed = parcelReportSchema.parse(JSON.parse(report.reportData));
    return !isPlaceholderAddress(parsed.address) && hasUsableGeometry(parsed.coordinates);
  } catch (err) {
    console.warn(`[Cache] Stale or invalid cached report schema detected:`, err instanceof Error ? err.message : err);
    return false;
  }
}

const autocomplete = os
  .input(parcelAutocompleteInputSchema)
  .output(parcelSearchItemSchema.array())
  .handler(async ({ input }) => {
    return searchAddressAutocomplete(input.query.trim());
  });

const getReport = os
  .input(parcelLookupInputSchema)
  .output(parcelReportSchema)
  .handler(async ({ input }) => {
    const existing = await prisma.parcelReport.findUnique({
      where: { cadastralRegNo: input.cadastralRegNo },
    });

    if (existing && !input.forceRefresh && shouldReuseCachedReport(existing)) {
      const parsed = parcelReportSchema.parse(JSON.parse(existing.reportData));
      const safeId = parsed.cadastralRegNo.replace(/[^a-zA-Z0-9-_.]/g, "_");
      return {
        ...parsed,
        cached: true,
        cacheAgeDays: cacheAgeDays(existing.updatedAt),
        pdfUrl: existing.pdfCachedPath ? `/api/pdf/${safeId}.pdf` : undefined,
      };
    }

    const parsedCoordinates = existing?.coordinates ? JSON.parse(existing.coordinates) : undefined;
    const report = await buildComprehensiveReport(
      input.cadastralRegNo,
      existing?.address && !isPlaceholderAddress(existing.address)
        ? existing.address
        : buildUnknownAddress(input.cadastralRegNo),
      parsedCoordinates,
    );

    const pdfPath = await renderReportPdf(report);
    const safeId = report.cadastralRegNo.replace(/[^a-zA-Z0-9-_.]/g, "_");
    const hydrated = {
      ...report,
      pdfUrl: pdfPath ? `/api/pdf/${safeId}.pdf` : undefined,
    };

    await prisma.parcelReport.upsert({
      where: { cadastralRegNo: input.cadastralRegNo },
      update: {
        address: hydrated.address,
        coordinates: JSON.stringify(hydrated.coordinates),
        reportData: JSON.stringify(hydrated),
        pdfCachedPath: pdfPath,
      },
      create: {
        address: hydrated.address,
        cadastralRegNo: hydrated.cadastralRegNo,
        coordinates: JSON.stringify(hydrated.coordinates),
        reportData: JSON.stringify(hydrated),
        pdfCachedPath: pdfPath,
      },
    });

    return hydrated;
  });

// Reverse-resolve a clicked map coordinate to the parcel beneath it. BIIP first
// (authoritative boundaries); OSP ntr_sklypai as a fallback. Returns null when
// nothing covers the point, so the UI can say so rather than navigate nowhere.
const resolveByPoint = os
  .input(parcelPointInputSchema)
  .output(parcelPointResolutionSchema)
  .handler(async ({ input }) => {
    const biip = await resolveParcelByCoordinates(input.lng, input.lat);
    if (biip?.cadastralRegNo) return { cadastralRegNo: biip.cadastralRegNo };

    const ospCadastralRegNo = await fetchParcelByPoint(input.lat, input.lng);
    if (ospCadastralRegNo) return { cadastralRegNo: ospCadastralRegNo };

    return null;
  });

// All parcel outlines intersecting the map viewport bounding box (WGS84).
// The client calls this when zoomed in enough to render clickable polygons
// for every visible parcel instead of relying on a coordinate-to-parcel lookup.
const parcelsByBbox = os
  .input(parcelBboxInputSchema)
  .output(neighborParcelSchema.array())
  .handler(async ({ input }) => {
    return fetchParcelsByBbox(input.minLat, input.minLng, input.maxLat, input.maxLng);
  });

export const appRouter = {
  parcel: {
    autocomplete,
    getReport,
    resolveByPoint,
    parcelsByBbox,
  },
};

export type AppRouter = typeof appRouter;
