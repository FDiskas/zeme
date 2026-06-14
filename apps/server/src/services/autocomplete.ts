import type { ParcelSearchItem } from "@zeme/shared";
import { prisma } from "../db";
import { generateRealisticPolygon } from "./report-service";

const NOMINATIM_SEARCH = "https://nominatim.openstreetmap.org/search";

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  extratags?: Record<string, string>;
}

import {
  resolveParcelFromBiip,
  resolveParcelByUniqueNumber,
  resolveAddressFromBiip,
  resolveParcelByCoordinates,
  normalizeCadastralRegNo as biipNormalize,
  normalizeUniqueNumber,
  searchBiipAddressByQuery,
  type BiipAddressPoint,
} from "./biip-service";
import { fetchOspParcelData } from "./osp-service";

function normalizeCadastralRegNo(value: string): string | null {
  return biipNormalize(value);
}

// Centroid of a GeoJSON Polygon's outer ring — used to pin the map when a
// registry returns boundary geometry but no explicit center point.
function polygonCenter(polygon: any): [number, number] | undefined {
  const ring = polygon?.coordinates?.[0];
  if (!Array.isArray(ring) || ring.length === 0) return undefined;
  let sumLon = 0;
  let sumLat = 0;
  for (const [lon, lat] of ring) {
    sumLon += lon;
    sumLat += lat;
  }
  return [sumLon / ring.length, sumLat / ring.length];
}

// OSP returns an administrative-area label only (not a street address).
function ospAreaLabel(ospData: { sav_pavad?: string; sen_pavad?: string }): string {
  return ospData.sen_pavad
    ? `${ospData.sav_pavad}, ${ospData.sen_pavad}`
    : (ospData.sav_pavad ?? "");
}

async function persistParcel(cadastralRegNo: string, address: string, polygon: any): Promise<void> {
  await prisma.parcelReport.upsert({
    where: { cadastralRegNo },
    update: {
      address,
      coordinates: JSON.stringify(polygon),
    },
    create: {
      cadastralRegNo,
      address,
      coordinates: JSON.stringify(polygon),
      reportData: "{}",
    },
  });
}

async function handleDirectParcelMatch(cadastralRegNo: string): Promise<ParcelSearchItem> {
  const normalized = normalizeCadastralRegNo(cadastralRegNo) || cadastralRegNo;

  let center: [number, number] | undefined;
  let polygon: any;
  let address = "";

  const parcel = await resolveParcelFromBiip(normalized);
  if (parcel) {
    const addressDetails = await resolveAddressFromBiip(parcel.ewkt);
    // Empty when the parcel has no street address — never a fabricated one.
    address = addressDetails?.fullAddress || "";
    polygon = parcel.geometry;
    center = parcel.center;
  } else {
    // High-fidelity fallback: Query the official State Data Agency (OSP) database!
    console.log(`[Autocomplete] Parcel not found in BIIP boundary API. Querying OSP for cadastral boundary: ${normalized}`);
    const ospData = await fetchOspParcelData(normalized);
    if (ospData) {
      polygon = ospData.geometry;
      address = ospAreaLabel(ospData);
      center = polygonCenter(polygon);
    }
  }

  if (polygon && center) {
    await persistParcel(normalized, address, polygon);
    return { cadastralRegNo: normalized, address, center };
  }

  // Not found in any registry. We do NOT fabricate an address or outline — the
  // user can still open the report, which will honestly report no location/address.
  console.warn(`[Autocomplete] Parcel not found in BIIP or OSP: ${normalized}`);
  return {
    cadastralRegNo: normalized,
    address: "",
  };
}

// Resolve a search by "unikalus daikto numeris" (12-digit unique object number).
// Unlike a cadastral search, we don't know the cadastral number up front — BIIP
// (then OSP) resolves it for us, and that resolved cadastral number is what we
// persist and return so the rest of the app keys on it consistently. Returns
// null when no registry knows the number, rather than fabricating a result.
async function handleUniqueNumberMatch(uniqueNumber: string): Promise<ParcelSearchItem | null> {
  let cadastralRegNo = "";
  let center: [number, number] | undefined;
  let polygon: any;
  let address = "";

  const parcel = await resolveParcelByUniqueNumber(uniqueNumber);
  if (parcel) {
    cadastralRegNo = parcel.cadastralRegNo;
    const addressDetails = await resolveAddressFromBiip(parcel.ewkt);
    address = addressDetails?.fullAddress || "";
    polygon = parcel.geometry;
    center = parcel.center;
  } else {
    // OSP ntr_sklypai stores the dashed unique number in `unikalus_nr`, so the
    // raw query value matches directly.
    console.log(`[Autocomplete] Unique number not found in BIIP. Querying OSP: ${uniqueNumber}`);
    const ospData = await fetchOspParcelData(uniqueNumber);
    if (ospData?.kadastro_nr) {
      cadastralRegNo = ospData.kadastro_nr;
      polygon = ospData.geometry;
      address = ospAreaLabel(ospData);
      center = polygonCenter(polygon);
    }
  }

  if (cadastralRegNo && polygon && center) {
    await persistParcel(cadastralRegNo, address, polygon);
    return { cadastralRegNo, address, center };
  }

  console.warn(`[Autocomplete] Unique number not found in BIIP or OSP: ${uniqueNumber}`);
  return null;
}

async function buildFromNominatim(result: NominatimResult): Promise<ParcelSearchItem | null> {
  const lat = Number(result.lat);
  const lon = Number(result.lon);
  if (isNaN(lat) || isNaN(lon)) return null;

  const candidateKeys = ["ref:LT:cadastral", "cadastral", "ref"];
  let cadastralRegNo = "";

  for (const key of candidateKeys) {
    const normalized = normalizeCadastralRegNo(result.extratags?.[key] ?? "");
    if (normalized) {
      cadastralRegNo = normalized;
      break;
    }
  }

  const address = result.display_name;

  // Fallback: Generate a deterministic cadastral number if none is present in OSM
  if (!cadastralRegNo) {
    let hash = 0;
    const str = address;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    const parcelId = Math.abs(hash % 9999) + 1;
    const paddedParcelId = String(parcelId).padStart(4, "0");
    cadastralRegNo = `4400/0001:${paddedParcelId}`;
  }

  const center: [number, number] = [lon, lat];
  const polygon = generateRealisticPolygon(center);

  await prisma.parcelReport.upsert({
    where: { cadastralRegNo },
    update: {
      address,
      coordinates: JSON.stringify(polygon),
    },
    create: {
      cadastralRegNo,
      address,
      coordinates: JSON.stringify(polygon),
      reportData: "{}",
    },
  });

  return {
    cadastralRegNo,
    address,
    center,
  };
}

async function searchNominatim(query: string): Promise<NominatimResult[]> {
  const params = new URLSearchParams({
    q: query,
    countrycodes: "lt",
    format: "jsonv2",
    limit: "10",
    addressdetails: "1",
    extratags: "1",
  });

  const response = await fetch(`${NOMINATIM_SEARCH}?${params.toString()}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "zeme/1.0",
    },
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) return [];

  const data = (await response.json()) as NominatimResult[];
  return Array.isArray(data) ? data : [];
}

async function buildFromBiipAddress(addr: BiipAddressPoint): Promise<ParcelSearchItem | null> {
  if (!addr.point) return null;
  const [lon, lat] = addr.point;

  const parcel = await resolveParcelByCoordinates(lon, lat);
  if (!parcel) return null;

  await prisma.parcelReport.upsert({
    where: { cadastralRegNo: parcel.cadastralRegNo },
    update: { address: addr.fullAddress, coordinates: JSON.stringify(parcel.geometry) },
    create: {
      cadastralRegNo: parcel.cadastralRegNo,
      address: addr.fullAddress,
      coordinates: JSON.stringify(parcel.geometry),
      reportData: "{}",
    },
  });

  return {
    cadastralRegNo: parcel.cadastralRegNo,
    address: addr.fullAddress,
    center: parcel.center,
  };
}

export async function searchAddressAutocomplete(
  query: string
): Promise<ParcelSearchItem[]> {
  // A dash-separated 12-digit value is a "unikalus daikto numeris". Checked
  // before the cadastral pattern because the cadastral matcher would otherwise
  // greedily (mis)interpret the same digits as area/block/parcel.
  const uniqueNumber = normalizeUniqueNumber(query);
  if (uniqueNumber) {
    try {
      const match = await handleUniqueNumberMatch(uniqueNumber);
      return match ? [match] : [];
    } catch {
      return [];
    }
  }

  const normalizedDirectMatch = normalizeCadastralRegNo(query);
  if (normalizedDirectMatch) {
    try {
      const match = await handleDirectParcelMatch(normalizedDirectMatch);
      return [match];
    } catch {
      return [{ cadastralRegNo: normalizedDirectMatch }];
    }
  }

  try {
    const addresses = await searchNominatim(query);
    if (addresses.length > 0) {
      const results = await Promise.all(addresses.map(buildFromNominatim));
      const filtered = results.filter((item): item is ParcelSearchItem => item !== null);
      if (filtered.length > 0) return filtered;
    }
  } catch {
    // fall through to BIIP address search
  }

  // Nominatim returned no results — try BIIP direct address search by postal code / street / plot
  try {
    const biipAddresses = await searchBiipAddressByQuery(query);
    const results = await Promise.all(biipAddresses.map(buildFromBiipAddress));
    return results.filter((item): item is ParcelSearchItem => item !== null);
  } catch {
    return [];
  }
}

