import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { NeighborParcel, ParcelReport, ParcelSearchItem } from "@zeme/shared";

type ParcelClient = {
  parcel: {
    autocomplete(input: { query: string }): Promise<ParcelSearchItem[]>;
    getReport(input: { cadastralRegNo: string; forceRefresh?: boolean }): Promise<ParcelReport>;
    resolveByPoint(input: { lat: number; lng: number }): Promise<{ cadastralRegNo: string } | null>;
    parcelsByBbox(input: { minLat: number; minLng: number; maxLat: number; maxLng: number }): Promise<NeighborParcel[]>;
  };
};

const link = new RPCLink({
  url: `${window.location.origin}/rpc`,
});

export const orpcClient = createORPCClient<ParcelClient>(link);

// In-flight de-duplication for getReport. React StrictMode (dev) mounts effects
// twice, and a user can trigger overlapping loads (e.g. fast navigation). Two
// identical concurrent requests — same cadastral number + refresh flag — share a
// single network call instead of hitting /rpc/parcel/getReport twice.
const reportInFlight = new Map<string, Promise<ParcelReport>>();

export function getParcelReport(input: {
  cadastralRegNo: string;
  forceRefresh?: boolean;
}): Promise<ParcelReport> {
  const key = `${input.cadastralRegNo}|${input.forceRefresh ? "1" : "0"}`;
  const existing = reportInFlight.get(key);
  if (existing) return existing;

  const request = orpcClient.parcel
    .getReport(input)
    .finally(() => reportInFlight.delete(key));
  reportInFlight.set(key, request);
  return request;
}

// Which parcel sits under a clicked map coordinate (WGS84), or null if none.
export function resolveParcelByPoint(lat: number, lng: number): Promise<{ cadastralRegNo: string } | null> {
  return orpcClient.parcel.resolveByPoint({ lat, lng });
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
