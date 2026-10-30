import { eventIterator, ORPCError, os } from "@orpc/server";
import { basename } from "node:path";
import { prisma } from "./db";
import {
  parcelAutocompleteInputSchema,
  parcelBboxInputSchema,
  parcelLookupInputSchema,
  parcelPanelRetryInputSchema,
  parcelPdfInputSchema,
  parcelPdfOutputSchema,
  parcelPointInputSchema,
  parcelPointResolutionSchema,
  parcelReportSchema,
  parcelSearchItemSchema,
  neighborParcelSchema,
  orthoSeriesSchema,
  reportEventSchema,
  REPORT_REFRESH_COOLDOWN_MS,
  type ReportEvent,
  type ReportPanelKey,
} from "@zeme/shared";
import {
  buildComprehensiveReport,
  cacheAgeDays,
  hasUsableGeometry,
  isPlaceholderAddress,
  isCacheFresh,
  fetchPanel,
  panelContextOf,
  resolveLocalityOf,
} from "./services/report-service";
import { resolveParcelByCoordinates } from "./services/biip-service";
import { fetchParcelByPoint, fetchParcelsByBbox, formatUniqueNumber } from "./services/osp-service";
import { getMarketValuePanel } from "./services/masvert-service";
import { searchAddressAutocomplete } from "./services/autocomplete";
import { listOrthoSeries } from "./services/ortho-service";

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

// Panels added after reports were first cached; a cached report missing one
// fetches it on read (see upgradeCachedReport).
const BACKFILLED_PANELS: ReportPanelKey[] = [
  "nearby-services",
  "crime-stats",
  "flood-risk",
  "census-households",
  "broadband",
  "ssva-built-up",
  "energy-certificates",
];

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

// Reports cached before these panels / locality existed get them
// added on read instead of waiting out the six-month cache. Saved only when
// every added piece succeeded, so a transient upstream error is retried on the
// next view.
async function upgradeCachedReport(
  cadastralRegNo: string,
  report: ParcelReport,
  updatedAt: Date,
): Promise<ParcelReport> {
  if (!hasUsableGeometry(report.coordinates)) return report;

  const stale = BACKFILLED_PANELS.filter((key) => {
    const panel = report.reportPanels.find((p) => p.key === key);
    return !panel || isOutdatedPanel(panel);
  });
  const needsLocality = report.hasStreetAddress === false && !report.locality;
  if (stale.length === 0 && !needsLocality) return report;

  const ctx = panelContextOf(report);
  const [panels, locality] = await Promise.all([
    Promise.all(stale.map((key) => fetchPanel(key, ctx))),
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

const refreshAvailableAt = (builtAt: Date) =>
  new Date(builtAt.getTime() + REPORT_REFRESH_COOLDOWN_MS).toISOString();

// A rebuild under way. It keeps every event it has sent, so a second reader
// of the same parcel (a double click, two tabs) catches up and then follows
// along instead of querying every upstream service again. It runs to the end
// and caches the report even when its readers leave.
class RebuildJob {
  private events: ReportEvent[] = [];
  private failure: unknown;
  private finished = false;
  private wake = new Set<() => void>();

  constructor(build: (send: (event: ReportEvent) => void) => Promise<void>, onSettled: () => void) {
    build((event) => this.send(event))
      .catch((err) => {
        this.failure = err ?? new Error("Report build failed");
      })
      .finally(() => {
        this.finished = true;
        this.notify();
        onSettled();
      });
  }

  private send(event: ReportEvent) {
    this.events.push(event);
    this.notify();
  }

  private notify() {
    const waiting = [...this.wake];
    this.wake.clear();
    waiting.forEach((resume) => resume());
  }

  async *follow(): AsyncGenerator<ReportEvent> {
    let next = 0;
    while (true) {
      while (next < this.events.length) yield this.events[next++]!;
      if (this.finished) {
        if (this.failure) throw this.failure;
        return;
      }
      await new Promise<void>((resume) => this.wake.add(resume));
    }
  }
}

const rebuildsInFlight = new Map<string, RebuildJob>();

// The report as a stream (see reportEventSchema): a cached report at once, a
// rebuild piece by piece, so the page can show which sources are still
// answering and draw the parcel before the slowest of them is done.
const streamReport = os
  .input(parcelLookupInputSchema)
  .output(eventIterator(reportEventSchema))
  .handler(async function* ({ input }) {
    const existing = await prisma.parcelReport.findUnique({
      where: { cadastralRegNo: input.cadastralRegNo },
    });

    // A forced refresh within REPORT_REFRESH_COOLDOWN_MS of the last build is
    // answered from the cache, so the upstream registries see one rebuild per
    // parcel per window at most. Enforced here, not in the browser, which can
    // be bypassed.
    const usable = existing !== null && shouldReuseCachedReport(existing);
    const coolingDown = usable && Date.now() - existing.updatedAt.getTime() < REPORT_REFRESH_COOLDOWN_MS;

    if (usable && (!input.forceRefresh || coolingDown)) {
      const parsed = await upgradeCachedReport(
        input.cadastralRegNo,
        await refreshMissingMarketValue(
          input.cadastralRegNo,
          parcelReportSchema.parse(JSON.parse(existing.reportData)),
          existing.updatedAt,
        ),
        existing.updatedAt,
      );
      yield { type: "report", report: cachedResponse(parsed, existing.updatedAt) };
      return;
    }

    let job = rebuildsInFlight.get(input.cadastralRegNo);
    if (!job) {
      // Dropped once finished; a later reader then finds the cached report.
      job = new RebuildJob(
        (send) => rebuildReport(input.cadastralRegNo, existing, send),
        () => rebuildsInFlight.delete(input.cadastralRegNo),
      );
      rebuildsInFlight.set(input.cadastralRegNo, job);
    }
    yield* job.follow();
  });

const cachedResponse = (report: ParcelReport, updatedAt: Date): ParcelReport => ({
  ...report,
  cached: true,
  cacheAgeDays: cacheAgeDays(updatedAt),
  refreshAvailableAt: refreshAvailableAt(updatedAt),
});

// Builds the report from the upstream sources, telling `send` as each piece
// arrives, and caches it.
async function rebuildReport(
  cadastralRegNo: string,
  existing: { address: string; coordinates: string } | null,
  send: (event: ReportEvent) => void,
): Promise<void> {
  const parsedCoordinates = existing?.coordinates ? JSON.parse(existing.coordinates) : undefined;
  const report = await buildComprehensiveReport(
    cadastralRegNo,
    existing?.address && !isPlaceholderAddress(existing.address)
      ? existing.address
      : "",
    parsedCoordinates,
    {
      parcel: (found) => send({ type: "parcel", report: found }),
      panel: (panel) => send({ type: "panel", panel }),
    },
  );

  await prisma.parcelReport.upsert({
    where: { cadastralRegNo },
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

  send({ type: "report", report: { ...report, refreshAvailableAt: refreshAvailableAt(new Date()) } });
}

// Panel retries under way, by cadastral number + panel key.
const panelRetriesInFlight = new Map<string, Promise<ParcelReport>>();

// Asks one failed source again and saves its panel into the cached report.
// Only a failed panel is fetched (one that has since loaded comes back as it
// is), and only one upstream service is queried, so this is not held to the
// report's refresh cooldown.
const retryPanel = os
  .input(parcelPanelRetryInputSchema)
  .output(parcelReportSchema)
  .handler(async ({ input }) => {
    const id = `${input.cadastralRegNo}|${input.panelKey}`;
    const inFlight = panelRetriesInFlight.get(id);
    if (inFlight) return inFlight;
    const retry = retryCachedPanel(input.cadastralRegNo, input.panelKey).finally(() =>
      panelRetriesInFlight.delete(id),
    );
    panelRetriesInFlight.set(id, retry);
    return retry;
  });

async function retryCachedPanel(cadastralRegNo: string, key: ReportPanelKey): Promise<ParcelReport> {
  const existing = await prisma.parcelReport.findUnique({ where: { cadastralRegNo } });
  if (!existing || !shouldReuseCachedReport(existing)) {
    throw new ORPCError("NOT_FOUND", { message: "Report not found. Fetch the report first." });
  }
  const report = parcelReportSchema.parse(JSON.parse(existing.reportData));
  const current = report.reportPanels.find((p) => p.key === key);
  if (current && current.status !== "error") return cachedResponse(report, existing.updatedAt);

  const ctx = panelContextOf(report);
  const panel = await fetchPanel(key, ctx);
  const footprints = key === "grpk-buildings" && panel.status !== "error" ? (await ctx.grpk()).footprints : undefined;
  const updated: ParcelReport = {
    ...report,
    ...(footprints ? { buildings: footprints } : {}),
    reportPanels: current
      ? report.reportPanels.map((p) => (p.key === key ? panel : p))
      : [...report.reportPanels, panel],
  };

  if (panel.status !== "error") {
    // updatedAt pinned: the rest of the report keeps its age and cooldown.
    await prisma.parcelReport.update({
      where: { cadastralRegNo },
      data: { reportData: JSON.stringify(updated), pdfCachedPath: null, updatedAt: existing.updatedAt },
    });
  }
  return cachedResponse(updated, existing.updatedAt);
}

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

// The NŽT orthophoto series on offer for the map's year slider (see ortho-service).
const orthoSeries = os.output(orthoSeriesSchema.array()).handler(() => listOrthoSeries());

export const appRouter = {
  parcel: {
    autocomplete,
    streamReport,
    retryPanel,
    generatePdf,
    resolveByPoint,
    parcelsByBbox,
  },
  map: {
    orthoSeries,
  },
};

export type AppRouter = typeof appRouter;
