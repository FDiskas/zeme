import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type {
  NeighborParcel,
  OrthoSeries,
  ParcelPdfOutput,
  ParcelReport,
  ParcelSearchItem,
  ReportEvent,
  ReportPanelKey,
} from "@zeme/shared";

type ParcelClient = {
  parcel: {
    autocomplete(input: { query: string }): Promise<ParcelSearchItem[]>;
    streamReport(
      input: { cadastralRegNo: string; forceRefresh?: boolean },
      options?: { signal?: AbortSignal },
    ): Promise<AsyncIterable<ReportEvent>>;
    retryPanel(input: { cadastralRegNo: string; panelKey: ReportPanelKey }): Promise<ParcelReport>;
    generatePdf(input: { cadastralRegNo: string }): Promise<ParcelPdfOutput>;
    resolveByPoint(input: { lat: number; lng: number }): Promise<{ cadastralRegNo: string } | null>;
    parcelsByBbox(input: { minLat: number; minLng: number; maxLat: number; maxLng: number }): Promise<NeighborParcel[]>;
  };
  map: {
    orthoSeries(): Promise<OrthoSeries[]>;
  };
};

const link = new RPCLink({
  url: `${window.location.origin}/rpc`,
});

export const orpcClient = createORPCClient<ParcelClient>(link);

// A parcel's report as it is built (see reportEventSchema): the last event
// carries the finished report. Two readers of the same parcel (StrictMode's
// double mount, two tabs) share one build on the server, so no de-duplication
// is needed here.
export async function* streamParcelReport(
  input: { cadastralRegNo: string; forceRefresh?: boolean },
  signal: AbortSignal,
): AsyncGenerator<ReportEvent> {
  yield* await orpcClient.parcel.streamReport(input, { signal });
}

// Asks one failed source of a cached report again; returns the report with
// that panel replaced (still failed if the source failed again).
export function retryReportPanel(cadastralRegNo: string, panelKey: ReportPanelKey): Promise<ParcelReport> {
  return orpcClient.parcel.retryPanel({ cadastralRegNo, panelKey });
}

// Which parcel sits under a clicked map coordinate (WGS84), or null if none.
export function resolveParcelByPoint(lat: number, lng: number): Promise<{ cadastralRegNo: string } | null> {
  return orpcClient.parcel.resolveByPoint({ lat, lng });
}

// Generate (or retrieve cached) PDF for a given parcel. Renders on the server
// and returns the URL that can be opened directly in the browser.
export function generateParcelPdf(cadastralRegNo: string): Promise<ParcelPdfOutput> {
  return orpcClient.parcel.generatePdf({ cadastralRegNo });
}

// All parcel outlines (cadastralRegNo + geometry) within the given WGS84 bbox.
// Used by the map's viewport-parcel layer so every visible parcel is directly
// clickable without a coordinate-to-parcel server round-trip.
export function getParcelsByBbox(bbox: {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}): Promise<NeighborParcel[]> {
  return orpcClient.parcel.parcelsByBbox(bbox);
}

// The NŽT orthophoto series on offer, oldest first, "Naujausia" last. Asked
// once per page load and shared by every map.
let orthoSeriesRequest: Promise<OrthoSeries[]> | null = null;

export function getOrthoSeries(): Promise<OrthoSeries[]> {
  orthoSeriesRequest ??= orpcClient.map.orthoSeries().catch((error) => {
    orthoSeriesRequest = null;
    throw error;
  });
  return orthoSeriesRequest;
}
