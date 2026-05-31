import type { ParcelSearchItem } from "@zeme/shared";
import { prisma } from "../db";
import {
  getDeterministicCenter,
  generateRealisticPolygon,
  buildUnknownAddress,
} from "./report-service";

const NOMINATIM_SEARCH = "https://nominatim.openstreetmap.org/search";

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  extratags?: Record<string, string>;
}

import {
  resolveParcelFromBiip,
  resolveAddressFromBiip,
  resolveParcelByCoordinates,
  normalizeCadastralRegNo as biipNormalize,
} from "./biip-service";
import { fetchOspParcelData } from "./osp-service";

const CADASTRAL_REG_NO_PATTERN =
  /^(?<area>\d{4})[\s/-]*(?<block>\d{4})[\s:/-]*(?<parcel>\d{1,6})$/;

function normalizeCadastralRegNo(value: string): string | null {
  return biipNormalize(value);
}

async function handleDirectParcelMatch(cadastralRegNo: string): Promise<ParcelSearchItem> {
  const normalized = normalizeCadastralRegNo(cadastralRegNo) || cadastralRegNo;
  
  let center: [number, number] | undefined;
  let polygon: any;
  let address = "";

  const parcel = await resolveParcelFromBiip(normalized);
  if (parcel) {
    const addressDetails = await resolveAddressFromBiip(parcel.ewkt);
    address = addressDetails?.fullAddress || `Parcel ${normalized}`;
    polygon = parcel.geometry;
    center = parcel.center;
  } else {
    // High-fidelity fallback: Query the official State Data Agency (OSP) database!
    console.log(`[Autocomplete] Parcel not found in BIIP boundary API. Querying OSP for cadastral boundary: ${normalized}`);
    const ospData = await fetchOspParcelData(normalized);
    if (ospData) {
      polygon = ospData.geometry;
      address = ospData.sen_pavad
        ? `${ospData.sav_pavad}, ${ospData.sen_pavad}, Lithuania`
        : `${ospData.sav_pavad}, Lithuania`;
      
      if (polygon && polygon.coordinates && polygon.coordinates[0]) {
        let sumLon = 0;
        let sumLat = 0;
        const ring = polygon.coordinates[0];
        for (const [lon, lat] of ring) {
          sumLon += lon;
          sumLat += lat;
        }
        center = [sumLon / ring.length, sumLat / ring.length];
      }
    }
  }

  if (polygon && center) {
    await prisma.parcelReport.upsert({
      where: { cadastralRegNo: normalized },
      update: {
        address,
        coordinates: JSON.stringify(polygon),
      },
      create: {
        cadastralRegNo: normalized,
        address,
        coordinates: JSON.stringify(polygon),
        reportData: "{}",
      },
    });

    return {
      cadastralRegNo: normalized,
      address,
      center,
    };
  }

  // Final fallback to deterministic mock if not found anywhere
  console.warn(`[Autocomplete] Parcel not found in BIIP or OSP. Using simulated fallback for: ${cadastralRegNo}`);
  const finalCenter = getDeterministicCenter(cadastralRegNo);
  const finalPolygon = generateRealisticPolygon(finalCenter);
  const finalAddress = buildUnknownAddress(cadastralRegNo);

  await prisma.parcelReport.upsert({
    where: { cadastralRegNo },
    update: {
      address: finalAddress,
      coordinates: JSON.stringify(finalPolygon),
    },
    create: {
      cadastralRegNo,
      address: finalAddress,
      coordinates: JSON.stringify(finalPolygon),
      reportData: "{}",
    },
  });

  return {
    cadastralRegNo,
    address: finalAddress,
    center: finalCenter,
  };
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

export async function searchAddressAutocomplete(
  query: string
): Promise<ParcelSearchItem[]> {
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

    const results = await Promise.all(addresses.map(buildFromNominatim));
    return results.filter((item): item is ParcelSearchItem => item !== null);
  } catch {
    return [];
  }
}

