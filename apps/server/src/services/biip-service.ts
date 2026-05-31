import { biipClient } from "./biip-client";
import { parcelsSearch, addressesSearch, eldershipsSearch, roomsSearch } from "./biip/sdk.gen";
import type { Parcel } from "./biip/types.gen";
import type { ParcelSearchItem } from "@zeme/shared";

// BIIP search endpoints default to SRID 3346 (LKS-94); we request 4326 (WGS 84)
// everywhere so geometry can be rendered directly on Leaflet/OSM maps.
const WGS84 = 4326;
// Cursor page size cap accepted by the API.
const MAX_PAGE_SIZE = 100;
// Safety cap on paginated address/room fetches to avoid runaway loops.
const MAX_PAGES = 5;

const CADASTRAL_REG_NO_PATTERN =
  /^(?<area>\d{4})[\s/-]*(?<block>\d{4})[\s:/-]*(?<parcel>\d{1,6})$/;

export function normalizeCadastralRegNo(value: string): string | null {
  const match = value.trim().match(CADASTRAL_REG_NO_PATTERN);
  if (!match?.groups) return null;

  const { area, block, parcel } = match.groups;
  // Pad block and parcel to 4 digits for Registrų centras and BIIP API matching
  const paddedBlock = block.padStart(4, "0");
  const paddedParcel = parcel.padStart(4, "0");
  return `${area}/${paddedBlock}:${paddedParcel}`;
}

export interface ResolvedBiipParcel {
  cadastralRegNo: string;
  uniqueNumber: number;
  areaHa: number;
  geometry: {
    type: "Polygon";
    coordinates: [number, number][][];
  };
  center: [number, number];
  ewkt: string;
  municipalityName: string;
  purposeName: string;
  purposeFullName: string;
  purposeGroup: string;
  status: string;
  updatedAt: string;
}

export interface BiipAddressPoint {
  fullAddress: string;
  plotOrBuildingNumber: string;
  street: string;
  residentialArea: string;
  municipality: string;
  postalCode: string;
  point: [number, number] | null;
}

export interface ResolvedBiipAddresses {
  fullAddress: string;
  pointEwkt: string;
  eldership: string;
  addresses: BiipAddressPoint[];
}

export interface BiipRoom {
  roomNumber: string;
  fullAddress: string;
}

function parseCoordPairs(ringStr: string): [number, number][] {
  return ringStr
    .trim()
    .split(/\s*,\s*/)
    .flatMap((pair) => {
      const [lonStr, latStr] = pair.trim().split(/\s+/);
      const lon = Number(lonStr);
      const lat = Number(latStr);
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) return [];
      return [[lon, lat] as [number, number]];
    });
}

function parseEwktPolygon(ewkt: string) {
  if (!ewkt) return null;
  // Strip optional SRID prefix ("SRID=4326;")
  const body = ewkt.replace(/^SRID=\d+;/i, "").trim();

  // MULTIPOLYGON(((outer),(hole)),...) — take first polygon's outer ring only.
  // [^)]+ prevents crossing ring-boundary parens, which would produce NaN coords
  // that JSON.stringify silently turns into null values.
  const multiMatch = body.match(/^MULTIPOLYGON\s*\(\s*\(\s*\(([^)]+)\)/i);
  if (multiMatch) {
    const coords = parseCoordPairs(multiMatch[1]!);
    if (coords.length < 3) return null;
    return { type: "Polygon" as const, coordinates: [coords] };
  }

  // POLYGON((outer),(hole)) — take the outer ring only.
  const polyMatch = body.match(/^POLYGON\s*\(\s*\(([^)]+)\)/i);
  if (polyMatch) {
    const coords = parseCoordPairs(polyMatch[1]!);
    if (coords.length < 3) return null;
    return { type: "Polygon" as const, coordinates: [coords] };
  }

  return null;
}

function parseEwktPoint(ewkt: string): [number, number] | null {
  const match = ewkt.match(/POINT\s*\(([^)]+)\)/i);
  if (!match) return null;
  const [lonStr, latStr] = match[1].trim().split(/\s+/);
  const lon = Number(lonStr);
  const lat = Number(latStr);
  if (Number.isNaN(lon) || Number.isNaN(lat)) return null;
  return [lon, lat];
}

function getPolygonCenter(coords: [number, number][]): [number, number] {
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  for (const [lon, lat] of coords) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  return [(minLon + maxLon) / 2, (minLat + maxLat) / 2];
}

function mapParcel(raw: Parcel, cadastralRegNo?: string): ResolvedBiipParcel | null {
  const ewkt = raw.geometry?.data || "";
  const parsedPoly = parseEwktPolygon(ewkt);
  if (!parsedPoly) return null;

  return {
    cadastralRegNo: cadastralRegNo || raw.cadastral_number || "",
    uniqueNumber: raw.unique_number,
    areaHa: raw.area_ha,
    geometry: parsedPoly,
    center: getPolygonCenter(parsedPoly.coordinates[0]),
    ewkt,
    municipalityName: raw.municipality?.name || "",
    purposeName: raw.purpose?.name || "",
    purposeFullName: raw.purpose?.full_name || "",
    purposeGroup: raw.purpose?.purpose_group?.name || "",
    status: raw.status?.name || "",
    updatedAt: raw.updated_at || "",
  };
}

export async function resolveParcelFromBiip(cadastralRegNo: string): Promise<ResolvedBiipParcel | null> {
  const normalized = normalizeCadastralRegNo(cadastralRegNo);
  if (!normalized) return null;

  try {
    const response = await parcelsSearch({
      client: biipClient,
      query: { srid: WGS84, geometry_output_format: "ewkt" },
      body: {
        filters: [
          {
            parcels: {
              cadastral_number: {
                exact: normalized,
              },
            },
          },
        ],
      },
    });

    const raw = response.data?.items?.[0];
    if (!raw) return null;

    return mapParcel(raw, normalized);
  } catch (err) {
    console.error("Error fetching parcel from BIIP API:", err);
    return null;
  }
}

// Format address elegantly: "Vilniaus r. sav., Rudaminos sen., Kalviškių k., Žalioji g. 16A".
// `eldership` is optional — only the primary address is enriched with it to avoid
// an extra spatial request per address point.
function formatAddress(
  parts: { municipality: string; eldership?: string; residentialArea: string; street: string; plotNo: string },
): string {
  return [
    parts.municipality,
    parts.eldership,
    parts.residentialArea,
    parts.street ? `${parts.street} ${parts.plotNo}`.trim() : parts.plotNo,
  ]
    .filter(Boolean)
    .join(", ");
}

async function resolveEldership(pointEwkt: string): Promise<string> {
  if (!pointEwkt) return "";
  try {
    const response = await eldershipsSearch({
      client: biipClient,
      body: {
        filters: [{ geometry: { method: "intersects", ewkt: pointEwkt } }],
      },
    });
    return response.data?.items?.[0]?.name || "";
  } catch (err) {
    console.error("Error resolving eldership spatially:", err);
    return "";
  }
}

export async function resolveAddressFromBiip(
  ewktGeometry: string,
): Promise<ResolvedBiipAddresses | null> {
  try {
    const addresses: BiipAddressPoint[] = [];
    let cursor: string | undefined;

    // Collect every address point intersecting the parcel polygon — these are the
    // official addressed entrances/buildings on the parcel, not just the first one.
    for (let page = 0; page < MAX_PAGES; page++) {
      const response = await addressesSearch({
        client: biipClient,
        query: { srid: WGS84, size: MAX_PAGE_SIZE, cursor },
        body: {
          filters: [{ geometry: { method: "intersects", ewkt: ewktGeometry } }],
        },
      });

      const items = response.data?.items || [];
      for (const item of items) {
        const street = item.street?.name || "";
        const residentialArea = item.residential_area?.name || "";
        const municipality = item.municipality?.name || "";
        const plotOrBuildingNumber = item.plot_or_building_number || "";
        addresses.push({
          fullAddress: formatAddress({
            municipality,
            residentialArea,
            street,
            plotNo: plotOrBuildingNumber,
          }),
          plotOrBuildingNumber,
          street,
          residentialArea,
          municipality,
          postalCode: item.postal_code || "",
          point: parseEwktPoint(item.geometry?.data || ""),
        });
      }

      cursor = response.data?.next_page || undefined;
      if (!cursor || items.length === 0) break;
    }

    if (addresses.length === 0) return null;

    // Enrich the primary address with the eldership for a fully-qualified label.
    const primary = addresses[0]!;
    const primaryItemEwkt = primary.point
      ? `SRID=${WGS84};POINT(${primary.point[0]} ${primary.point[1]})`
      : "";
    const eldership = await resolveEldership(primaryItemEwkt);
    const fullAddress = formatAddress({
      municipality: primary.municipality,
      eldership,
      residentialArea: primary.residentialArea,
      street: primary.street,
      plotNo: primary.plotOrBuildingNumber,
    });

    return {
      fullAddress,
      pointEwkt: primaryItemEwkt,
      eldership,
      addresses,
    };
  } catch (err) {
    console.error("Error fetching address from BIIP API:", err);
    return null;
  }
}

// Rooms (apartments / individual rooms) addressed within the buildings on a parcel.
// This is the closest BIIP gets to per-building/unit data.
export async function resolveRoomsFromBiip(ewktGeometry: string): Promise<BiipRoom[]> {
  try {
    const rooms: BiipRoom[] = [];
    let cursor: string | undefined;

    for (let page = 0; page < MAX_PAGES; page++) {
      const response = await roomsSearch({
        client: biipClient,
        query: { srid: WGS84, size: MAX_PAGE_SIZE, cursor },
        body: {
          filters: [{ geometry: { method: "intersects", ewkt: ewktGeometry } }],
        },
      });

      const items = response.data?.items || [];
      for (const item of items) {
        const addr = item.address;
        rooms.push({
          roomNumber: item.room_number || "",
          fullAddress: formatAddress({
            municipality: addr?.municipality?.name || "",
            residentialArea: addr?.residential_area?.name || "",
            street: addr?.street?.name || "",
            plotNo: addr?.plot_or_building_number || "",
          }),
        });
      }

      cursor = response.data?.next_page || undefined;
      if (!cursor || items.length === 0) break;
    }

    return rooms;
  } catch (err) {
    console.error("Error fetching rooms from BIIP API:", err);
    return [];
  }
}

export async function resolveParcelByCoordinates(lon: number, lat: number): Promise<ResolvedBiipParcel | null> {
  try {
    const response = await parcelsSearch({
      client: biipClient,
      query: { srid: WGS84, geometry_output_format: "ewkt" },
      body: {
        filters: [
          {
            geometry: {
              method: "intersects",
              ewkt: `SRID=${WGS84};POINT(${lon} ${lat})`,
            },
          },
        ],
      },
    });

    const raw = response.data?.items?.[0];
    if (!raw) return null;

    return mapParcel(raw);
  } catch (err) {
    console.error("Error resolving parcel by coordinates:", err);
    return null;
  }
}
