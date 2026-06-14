import type { ParcelReport } from "@zeme/shared";
import {
  fetchBiipBoundary,
  fetchBiipAddresses,
  fetchGeoportalConstraints,
  fetchGrpkBuildings,
  fetchSznsRestrictions,
  fetchAsgrRegulations,
  fetchKvrData,
  buildPdbisPanel,
  type UpstreamPanel,
} from "./connectors";
import {
  fetchOspParcelData,
  fetchOspBuildingPoints,
  getOspParcelSummaryPanel,
  getOspPollutionRisksPanel,
  fetchOspBuildingPermits,
  fetchNeighborParcels,
  formatUniqueNumber,
} from "./osp-service";
import { getMarketValuePanel } from "./masvert-service";

const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 30 * 6;

export function generateRealisticPolygon(center: [number, number]) {
  const [lon, lat] = center;
  const d = 0.00025;
  return {
    type: "Polygon" as const,
    coordinates: [
      [
        [lon - d, lat - d],
        [lon + d, lat - d * 0.6],
        [lon + d * 0.9, lat + d],
        [lon - d * 0.8, lat + d * 0.9],
        [lon - d, lat - d],
      ],
    ],
  };
}

export function hasUsableGeometry(coordinates: ParcelReport["coordinates"]): boolean {
  const ring = coordinates.coordinates[0] ?? [];
  return ring.length >= 4;
}

// Detects legacy/placeholder addresses that must never be shown as real. Empty
// string is NOT a placeholder — it is the honest "this parcel has no street
// address" state. We never fabricate addresses, so new reports only ever carry a
// real address, an administrative-area label, or "".
export function isPlaceholderAddress(address: string): boolean {
  if (!address) return false;
  return (
    /^Parcel\s+.+$/i.test(address) ||
    /^Parcel\s+.+,\s+Lithuania$/i.test(address) ||
    address.startsWith("Address unavailable for")
  );
}

export function cacheAgeDays(from: Date): number {
  return Math.max(0, Math.floor((Date.now() - from.getTime()) / (1000 * 60 * 60 * 24)));
}

export function isCacheFresh(updatedAt: Date): boolean {
  return Date.now() - updatedAt.getTime() <= SIX_MONTHS_MS;
}

import {
  resolveParcelFromBiip,
  resolveAddressFromBiip,
  resolveParcelByCoordinates,
  type ResolvedBiipAddresses,
} from "./biip-service";

export async function buildComprehensiveReport(
  cadastralRegNo: string,
  address: string,
  existingCoordinates?: any,
): Promise<ParcelReport> {
  // Resolved purely from this run's registry lookups — we never trust an incoming
  // address as a street address, and never fabricate one. hasStreetAddress stays
  // false unless BIIP gives us a real full address.
  let resolvedAddress = "";
  let hasStreetAddress = false;
  let resolvedCoordinates = existingCoordinates;

  let parcel = await resolveParcelFromBiip(cadastralRegNo);
  let ospParcel = await fetchOspParcelData(cadastralRegNo);

  if (!parcel && existingCoordinates) {
    const ring = existingCoordinates.coordinates?.[0] ?? [];
    if (ring.length > 0) {
      let sumLon = 0;
      let sumLat = 0;
      for (const [lon, lat] of ring) {
        sumLon += lon;
        sumLat += lat;
      }
      const centerLon = sumLon / ring.length;
      const centerLat = sumLat / ring.length;
      parcel = await resolveParcelByCoordinates(centerLon, centerLat);
    }
  }

  let addressDetails: ResolvedBiipAddresses | null = null;
  if (parcel) {
    resolvedCoordinates = parcel.geometry;
    addressDetails = await resolveAddressFromBiip(parcel.ewkt);
    if (addressDetails?.fullAddress) {
      resolvedAddress = addressDetails.fullAddress;
      hasStreetAddress = true;
    }
  } else if (ospParcel && ospParcel.geometry) {
    // High-fidelity geometry from the State Data Agency (OSP). OSP gives only an
    // administrative-area label (savivaldybė / seniūnija), not a street address —
    // so this is an area label, not a street address.
    resolvedCoordinates = ospParcel.geometry;
    resolvedAddress = ospParcel.sen_pavad
      ? `${ospParcel.sav_pavad}, ${ospParcel.sen_pavad}`
      : (ospParcel.sav_pavad ?? "");
  }

  // Last resort: a non-placeholder address the caller already had (e.g. from a
  // prior cache). Shown as a label only — not treated as a verified street address.
  if (!resolvedAddress && !isPlaceholderAddress(address)) {
    resolvedAddress = address;
  }

  const targetCadastralRegNo = parcel ? parcel.cadastralRegNo : (ospParcel ? ospParcel.kadastro_nr : cadastralRegNo);

  // Fetch OSP managed-building points once; reused for the GRPK footprint spatial
  // join and the Building Data Bank panel. BIIP address points come from the
  // already-resolved addressDetails (no extra call).
  const ospBuildingPoints = await fetchOspBuildingPoints(resolvedCoordinates);
  const biipAddressPoints = addressDetails?.addresses ?? [];

  // Dashed unique object number (e.g. 4400-4756-6034) for the RC mass-valuation
  // lookup. Empty when neither registry resolved a unique number → no value.
  const uniqueNrFormatted = formatUniqueNumber(
    ospParcel?.unikalus_nr || parcel?.uniqueNumber,
  );

  const [
    biipBoundary,
    biipAddresses,
    geoportal,
    grpkBuildings,
    szns,
    asgr,
    kvr,
    pdbis,
    ospParcelSummary,
    ospPollutionRisks,
    ospPermits,
    neighbors,
    marketValue
  ] = await Promise.all([
    fetchBiipBoundary(targetCadastralRegNo, resolvedAddress),
    fetchBiipAddresses(targetCadastralRegNo, resolvedCoordinates, addressDetails),
    fetchGeoportalConstraints(targetCadastralRegNo, resolvedAddress, resolvedCoordinates),
    fetchGrpkBuildings(resolvedCoordinates, biipAddressPoints, ospBuildingPoints),
    fetchSznsRestrictions(resolvedCoordinates),
    fetchAsgrRegulations(resolvedCoordinates),
    fetchKvrData(targetCadastralRegNo, resolvedAddress, resolvedCoordinates),
    Promise.resolve(buildPdbisPanel(ospBuildingPoints)),
    getOspParcelSummaryPanel(targetCadastralRegNo),
    getOspPollutionRisksPanel(resolvedCoordinates),
    fetchOspBuildingPermits(
      targetCadastralRegNo,
      ospParcel?.unikalus_nr || parcel?.uniqueNumber?.toString()
    ).catch(() => [] as any[]),
    fetchNeighborParcels(resolvedCoordinates, targetCadastralRegNo).catch(() => []),
    getMarketValuePanel(uniqueNrFormatted)
  ]);

  const ospPermitsPanel: UpstreamPanel = {
    key: "osp-building-permits",
    title: "Statybos leidimai (Infostatyba)",
    source: "OSP infostatyba FeatureServer",
    status: "ok",
    items: ospPermits,
    note: ospPermits.length === 0
      ? "Oficialaus Infostatyba registro duomenyse šiam sklypui statybos leidimų nerasta."
      : `Rasta ${ospPermits.length} statybos leidimo įrašų Infostatyba registre.`
  };

  // No usable geometry → honest empty polygon (no rings). The client then shows a
  // "location unknown" state instead of a confident pin at a fabricated point.
  const coordinates: ParcelReport["coordinates"] =
    resolvedCoordinates && hasUsableGeometry(resolvedCoordinates)
      ? resolvedCoordinates
      : { type: "Polygon", coordinates: [] };

  return {
    cadastralRegNo: targetCadastralRegNo,
    address: resolvedAddress,
    hasStreetAddress,
    coordinates,
    buildings: grpkBuildings.footprints,
    neighbors,
    fetchedAt: new Date().toISOString(),
    cached: false,
    sources: [
      "biip.lt",
      "Geoportal.lt GRPK",
      "Geoportal.lt rc_szns",
      "TPDR ASGR (planuojustatau.lt)",
      "KVR ArcGIS",
      "PDBIS",
      "OSP ntr_sklypai",
      "OSP infostatyba",
      "OSP tarsos_zidiniai",
      "Registrų centras masinis vertinimas"
    ],
    reportPanels: [
      ospParcelSummary,
      biipBoundary,
      marketValue,
      biipAddresses,
      grpkBuildings.panel,
      geoportal,
      asgr,
      szns,
      kvr,
      pdbis,
      ospPermitsPanel,
      ospPollutionRisks
    ],
  };
}

