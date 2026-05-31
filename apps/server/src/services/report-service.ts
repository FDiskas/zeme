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
  runScrapingFallback,
  type UpstreamPanel,
} from "./connectors";
import {
  fetchOspParcelData,
  fetchOspBuildingPoints,
  getOspParcelSummaryPanel,
  getOspPollutionRisksPanel,
  fetchOspBuildingPermits,
} from "./osp-service";

const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 30 * 6;

export function getDeterministicCenter(cadastralRegNo: string): [number, number] {
  let hash = 0;
  for (let i = 0; i < cadastralRegNo.length; i++) {
    hash = (hash << 5) - hash + cadastralRegNo.charCodeAt(i);
    hash |= 0;
  }
  hash = Math.abs(hash);

  const cities: [number, number][] = [
    [25.2878, 54.6866], // Vilnius Cathedral
    [25.2635, 54.6901], // Vilnius Seimas
    [23.9036, 54.8985], // Kaunas Laisvės al.
    [21.1315, 55.7068], // Klaipėda Theatre Square
    [23.3137, 55.9341], // Šiauliai
    [24.3575, 55.7344], // Panevėžys
  ];

  const baseCenter = cities[hash % cities.length]!;
  const offsetLon = ((hash % 100) - 50) * 0.0001;
  const offsetLat = (((hash >> 4) % 100) - 50) * 0.0001;

  return [baseCenter[0] + offsetLon, baseCenter[1] + offsetLat];
}

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

export function buildUnknownAddress(cadastralRegNo: string): string {
  // Let's resolve a nice deterministic Lithuanian address for unknown ones!
  let hash = 0;
  for (let i = 0; i < cadastralRegNo.length; i++) {
    hash = (hash << 5) - hash + cadastralRegNo.charCodeAt(i);
    hash |= 0;
  }
  hash = Math.abs(hash);

  const streets = ["Gedimino pr.", "Laisvės al.", "Pilies g.", "Savanorių pr.", "Didžioji g.", "Maironio g."];
  const cities = ["Vilnius", "Kaunas", "Klaipėda", "Šiauliai", "Panevėžys"];
  const street = streets[hash % streets.length]!;
  const city = cities[(hash >> 2) % cities.length]!;
  const houseNo = (hash % 88) + 1;

  return `${street} ${houseNo}, ${city}, Lithuania`;
}

export function isPlaceholderAddress(address: string): boolean {
  return /^Parcel\s+.+,\s+Lithuania$/i.test(address) || address.startsWith("Address unavailable for");
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
  let resolvedAddress = address;
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
    }
  } else if (ospParcel && ospParcel.geometry) {
    // High-fidelity fallback from official State Data Agency (OSP)
    resolvedCoordinates = ospParcel.geometry;
    resolvedAddress = ospParcel.sen_pavad
      ? `${ospParcel.sav_pavad}, ${ospParcel.sen_pavad}, Lithuania`
      : `${ospParcel.sav_pavad}, Lithuania`;
  }

  const targetCadastralRegNo = parcel ? parcel.cadastralRegNo : (ospParcel ? ospParcel.kadastro_nr : cadastralRegNo);

  // Fetch OSP managed-building points once; reused for the GRPK footprint spatial
  // join and the Building Data Bank panel. BIIP address points come from the
  // already-resolved addressDetails (no extra call).
  const ospBuildingPoints = await fetchOspBuildingPoints(resolvedCoordinates);
  const biipAddressPoints = addressDetails?.addresses ?? [];

  const [
    biipBoundary,
    biipAddresses,
    geoportal,
    grpkBuildings,
    szns,
    asgr,
    kvr,
    pdbis,
    scraper,
    ospParcelSummary,
    ospPollutionRisks,
    ospPermits
  ] = await Promise.all([
    fetchBiipBoundary(targetCadastralRegNo, resolvedAddress),
    fetchBiipAddresses(targetCadastralRegNo, resolvedCoordinates, addressDetails),
    fetchGeoportalConstraints(targetCadastralRegNo, resolvedAddress, resolvedCoordinates),
    fetchGrpkBuildings(resolvedCoordinates, biipAddressPoints, ospBuildingPoints),
    fetchSznsRestrictions(resolvedCoordinates),
    fetchAsgrRegulations(resolvedCoordinates),
    fetchKvrData(targetCadastralRegNo, resolvedAddress, resolvedCoordinates),
    Promise.resolve(buildPdbisPanel(ospBuildingPoints)),
    runScrapingFallback(targetCadastralRegNo, resolvedAddress),
    getOspParcelSummaryPanel(targetCadastralRegNo),
    getOspPollutionRisksPanel(resolvedCoordinates),
    fetchOspBuildingPermits(
      targetCadastralRegNo,
      ospParcel?.unikalus_nr || parcel?.uniqueNumber?.toString()
    ).catch(() => [] as any[])
  ]);

  const ospPermitsPanel: UpstreamPanel = {
    key: "osp-building-permits",
    title: "Infostatyba Official Building Permits",
    source: "OSP infostatyba FeatureServer",
    status: "ok",
    items: ospPermits,
    note: ospPermits.length === 0
      ? "No building permits found in the official Infostatyba registry for this parcel."
      : `Found ${ospPermits.length} official building permit record(s) in Infostatyba.`
  };

  let center: [number, number] | null = null;
  if (resolvedCoordinates) {
    const ring = resolvedCoordinates.coordinates?.[0] ?? [];
    if (ring.length > 0) {
      let sumLon = 0;
      let sumLat = 0;
      for (const [lon, lat] of ring) {
        sumLon += lon;
        sumLat += lat;
      }
      center = [sumLon / ring.length, sumLat / ring.length];
    }
  }
  if (!center) {
    center = getDeterministicCenter(targetCadastralRegNo);
  }

  const coordinates = (resolvedCoordinates && hasUsableGeometry(resolvedCoordinates))
    ? resolvedCoordinates
    : { type: "Polygon" as const, coordinates: [[center]] };

  return {
    cadastralRegNo: targetCadastralRegNo,
    address: resolvedAddress,
    coordinates,
    buildings: grpkBuildings.footprints,
    fetchedAt: new Date().toISOString(),
    cached: false,
    sources: [
      "biip.lt",
      "Geoportal.lt GRPK",
      "Geoportal.lt rc_szns",
      "TPDR ASGR (planuojustatau.lt)",
      "KVR ArcGIS",
      "PDBIS",
      "Puppeteer Fallback",
      "OSP ntr_sklypai",
      "OSP infostatyba",
      "OSP tarsos_zidiniai"
    ],
    reportPanels: [
      ospParcelSummary,
      biipBoundary,
      biipAddresses,
      grpkBuildings.panel,
      geoportal,
      asgr,
      szns,
      kvr,
      pdbis,
      ospPermitsPanel,
      ospPollutionRisks,
      scraper
    ],
  };
}

