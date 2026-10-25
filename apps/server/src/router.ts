import { os } from "@orpc/server";
import { basename } from "node:path";
import { prisma } from "./db";
import {
  parcelAutocompleteInputSchema,
  parcelBboxInputSchema,
  parcelLookupInputSchema,
  parcelPdfInputSchema,
  parcelPdfOutputSchema,
  parcelPointInputSchema,
  parcelPointResolutionSchema,
  parcelReportSchema,
  parcelSearchItemSchema,
  neighborParcelSchema,
} from "@zeme/shared";
import {
  buildComprehensiveReport,
  cacheAgeDays,
  hasUsableGeometry,
  isPlaceholderAddress,
  isCacheFresh,
  resolveLocalityOf,
} from "./services/report-service";
import { resolveParcelByCoordinates } from "./services/biip-service";
import { fetchParcelByPoint, fetchParcelsByBbox, formatUniqueNumber } from "./services/osp-service";
import { getMarketValuePanel } from "./services/masvert-service";
import {
  fetchNearbyServices,
  fetchCrimeStats,
  fetchFloodRisk,
  fetchCensusHouseholds,
  fetchBroadband,
} from "./services/neighbourhood-service";
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

type ParcelReport = ReturnType<typeof parcelReportSchema.parse>;

// The RC mass-valuation lookup is the flakiest source (scraped HTML, and RC takes
// it offline at times). A cached report without a value retries just that panel
// and saves it on success, rather than keeping the gap for the whole cache lifetime.
async function refreshMissingMarketValue(
  cadastralRegNo: string,
  report: ParcelReport,
  updatedAt: Date,
): Promise<ParcelReport> {
  const index = report.reportPanels.findIndex((p) => p.key === "rc-masvert");
  if (index < 0 || report.reportPanels[index]!.items.length > 0) return report;

  const summary = report.reportPanels.find((p) => p.key === "osp-parcel-summary");
  const uniqueNumber = formatUniqueNumber(
    (summary?.items[0] as { uniqueNumber?: string } | undefined)?.uniqueNumber,
  );
  if (!uniqueNumber) return report;

  const panel = await getMarketValuePanel(uniqueNumber);
  if (panel.items.length === 0) return report;

  const reportPanels = report.reportPanels.map((p, i) => (i === index ? panel : p));
  const updated = { ...report, reportPanels };
  // updatedAt is @updatedAt, so pin it explicitly: the rest of the report keeps
  // its original age and still expires on schedule.
  await prisma.parcelReport.update({
    where: { cadastralRegNo },
    data: { reportData: JSON.stringify(updated), pdfCachedPath: null, updatedAt },
  });
  return updated;
}

const NEIGHBOURHOOD_PANELS = {
  "nearby-services": fetchNearbyServices,
  "crime-stats": fetchCrimeStats,
  "flood-risk": fetchFloodRisk,
  "census-households": fetchCensusHouseholds,
  broadband: fetchBroadband,
} as const;

// A cached panel from an older build that lacks data the UI now relies on:
// nearby places without coordinates can't link to their parcel, and crime
// stats without the public-order offence counts.
const REQUIRED_ITEM_FIELD: Record<string, string> = {
  "nearby-services": "lat",
  "crime-stats": "publicOrderOffences",
};

function isOutdatedPanel(panel: ParcelReport["reportPanels"][number]): boolean {
  const field = REQUIRED_ITEM_FIELD[panel.key];
  return field !== undefined && panel.items.some((item) => !(field in item));
}

// Reports cached before the neighbourhood panels / locality existed get them
// added on read instead of waiting out the six-month cache. Saved only when
// every added piece succeeded, so a transient upstream error is retried on the
// next view.
async function upgradeCachedReport(
  cadastralRegNo: string,
  report: ParcelReport,
  updatedAt: Date,
): Promise<ParcelReport> {
  if (!hasUsableGeometry(report.coordinates)) return report;

  const stale = Object.entries(NEIGHBOURHOOD_PANELS).filter(([key]) => {
    const panel = report.reportPanels.find((p) => p.key === key);
    return !panel || isOutdatedPanel(panel);
  });
  const needsLocality = report.hasStreetAddress === false && !report.locality;
  if (stale.length === 0 && !needsLocality) return report;

  const [panels, locality] = await Promise.all([
    Promise.all(stale.map(([, fetchPanel]) => fetchPanel(report.coordinates))),
    needsLocality ? resolveLocalityOf(report.coordinates) : Promise.resolve(report.locality),
  ]);
  const replaced = new Set(panels.map((p) => p.key));
  const updated: ParcelReport = {
    ...report,
    ...(locality ? { locality } : {}),
    reportPanels: [...report.reportPanels.filter((p) => !replaced.has(p.key)), ...panels],
  };

  if (panels.every((p) => p.status !== "error") && (!needsLocality || locality)) {
    await prisma.parcelReport.update({
      where: { cadastralRegNo },
      data: { reportData: JSON.stringify(updated), pdfCachedPath: null, updatedAt },
    });
  }
  return updated;
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
      const parsed = await upgradeCachedReport(
        input.cadastralRegNo,
        await refreshMissingMarketValue(
          input.cadastralRegNo,
          parcelReportSchema.parse(JSON.parse(existing.reportData)),
          existing.updatedAt,
        ),
        existing.updatedAt,
      );
      return {
        ...parsed,
        cached: true,
        cacheAgeDays: cacheAgeDays(existing.updatedAt),
      };
    }

    const parsedCoordinates = existing?.coordinates ? JSON.parse(existing.coordinates) : undefined;
    const report = await buildComprehensiveReport(
      input.cadastralRegNo,
      existing?.address && !isPlaceholderAddress(existing.address)
        ? existing.address
        : "",
      parsedCoordinates,
    );

    await prisma.parcelReport.upsert({
      where: { cadastralRegNo: input.cadastralRegNo },
      update: {
        address: report.address,
        coordinates: JSON.stringify(report.coordinates),
        reportData: JSON.stringify(report),
        pdfCachedPath: null,
      },
      create: {
        address: report.address,
        cadastralRegNo: report.cadastralRegNo,
        coordinates: JSON.stringify(report.coordinates),
        reportData: JSON.stringify(report),
      },
    });

    return report;
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

// On-demand PDF generation. Returns the URL for an already-cached PDF if one
// exists, otherwise renders a new one and caches the path in the database.
// The cached file only counts when its name matches the current report data
// (see pdfFileName) and it is still on disk — a render that raced a report
// refresh, or a layout change, therefore falls through to a fresh render.
const generatePdf = os
  .input(parcelPdfInputSchema)
  .output(parcelPdfOutputSchema)
  .handler(async ({ input }) => {
    const { pdfFileName, renderReportPdf } = await import("./services/pdf");

    const existing = await prisma.parcelReport.findUnique({
      where: { cadastralRegNo: input.cadastralRegNo },
    });

    if (!existing?.reportData) {
      throw new Error("Report not found. Fetch the report first.");
    }

    const fileName = pdfFileName(input.cadastralRegNo, existing.reportData);
    const pdfUrl = `/api/pdf/${fileName}`;

    if (
      existing.pdfCachedPath &&
      basename(existing.pdfCachedPath) === fileName &&
      (await Bun.file(existing.pdfCachedPath).exists())
    ) {
      return { pdfUrl };
    }

    const report = parcelReportSchema.parse(JSON.parse(existing.reportData));
    const pdfPath = await renderReportPdf(report, fileName);
    if (!pdfPath) {
      throw new Error("PDF generation failed.");
    }

    await prisma.parcelReport.update({
      where: { cadastralRegNo: input.cadastralRegNo },
      data: { pdfCachedPath: pdfPath },
    });

    return { pdfUrl };
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
    generatePdf,
    resolveByPoint,
    parcelsByBbox,
  },
};

export type AppRouter = typeof appRouter;
