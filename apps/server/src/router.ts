import { os } from "@orpc/server";
import { prisma } from "./db";
import {
  parcelAutocompleteInputSchema,
  parcelLookupInputSchema,
  parcelReportSchema,
  parcelSearchItemSchema,
} from "@zeme/shared";
import {
  buildUnknownAddress,
  buildComprehensiveReport,
  cacheAgeDays,
  hasUsableGeometry,
  isPlaceholderAddress,
  isCacheFresh,
} from "./services/report-service";
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

export const appRouter = {
  parcel: {
    autocomplete,
    getReport,
  },
};

export type AppRouter = typeof appRouter;
