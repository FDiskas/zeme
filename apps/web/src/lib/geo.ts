import type { ParcelReport } from "@zeme/shared";

// Small, dependency-free geometry helpers for the parcel report: LKS-94
// projection, perimeter, point-in-polygon and KML export. Inputs are GeoJSON
// rings in WGS-84 ([lng, lat] pairs).

type Ring = number[][];

// LKS-94 (EPSG:3346): Transverse Mercator on GRS80, central meridian 24°,
// scale 0.9998, false easting 500 000 m. ETRS89 and WGS-84 differ by well
// under a metre in Lithuania, so WGS-84 input is used as-is. Forward series
// from Snyder, "Map Projections — A Working Manual", p. 61.
const A = 6378137;
const F = 1 / 298.257222101;
const E2 = F * (2 - F);
const EP2 = E2 / (1 - E2);
const K0 = 0.9998;
const LON0 = (24 * Math.PI) / 180;
const FALSE_EASTING = 500000;

export function wgs84ToLks94(lng: number, lat: number): { x: number; y: number } {
  const phi = (lat * Math.PI) / 180;
  const sin = Math.sin(phi);
  const cos = Math.cos(phi);
  const n = A / Math.sqrt(1 - E2 * sin * sin);
  const t = Math.tan(phi) ** 2;
  const c = EP2 * cos * cos;
  const a = ((lng * Math.PI) / 180 - LON0) * cos;
  const e4 = E2 * E2;
  const e6 = e4 * E2;
  const m =
    A *
    ((1 - E2 / 4 - (3 * e4) / 64 - (5 * e6) / 256) * phi -
      ((3 * E2) / 8 + (3 * e4) / 32 + (45 * e6) / 1024) * Math.sin(2 * phi) +
      ((15 * e4) / 256 + (45 * e6) / 1024) * Math.sin(4 * phi) -
      ((35 * e6) / 3072) * Math.sin(6 * phi));

  const x =
    FALSE_EASTING +
    K0 * n * (a + ((1 - t + c) * a ** 3) / 6 + ((5 - 18 * t + t * t + 72 * c - 58 * EP2) * a ** 5) / 120);
  const y =
    K0 *
    (m +
      n *
        Math.tan(phi) *
        ((a * a) / 2 +
          ((5 - t + 9 * c + 4 * c * c) * a ** 4) / 24 +
          ((61 - 58 * t + t * t + 600 * c - 330 * EP2) * a ** 6) / 720));
  return { x, y };
}

// The parcel's polygons as lists of rings (outer first, then holes). The shared
// schema types coordinates as a single Polygon, but a MultiPolygon can arrive.
export function parcelPolygons(report: ParcelReport): Ring[][] {
  const { type, coordinates } = report.coordinates;
  if (coordinates.length === 0) return [];
  if (type === "MultiPolygon") return coordinates as unknown as Ring[][];
  return [coordinates];
}

// Length of a ring in metres, measured in the LKS-94 plane — the plane the
// cadastral measurements themselves are made in.
function ringLengthM(ring: Ring): number {
  let total = 0;
  for (let i = 1; i < ring.length; i++) {
    const p = wgs84ToLks94(ring[i - 1]![0]!, ring[i - 1]![1]!);
    const q = wgs84ToLks94(ring[i]![0]!, ring[i]![1]!);
    total += Math.hypot(q.x - p.x, q.y - p.y);
  }
  return total;
}

// Every boundary line counts, holes included: an enclave's edge is a border too.
export function perimeterM(polygons: Ring[][]): number {
  return polygons.flat().reduce((sum, ring) => sum + ringLengthM(ring), 0);
}

// Planar (LKS-94) area of a polygon in m², holes subtracted.
export function polygonAreaM2(rings: Ring[]): number {
  return rings.reduce((sum, ring, i) => {
    let twice = 0;
    for (let j = 1; j < ring.length; j++) {
      const p = wgs84ToLks94(ring[j - 1]![0]!, ring[j - 1]![1]!);
      const q = wgs84ToLks94(ring[j]![0]!, ring[j]![1]!);
      twice += p.x * q.y - q.x * p.y;
    }
    const area = Math.abs(twice) / 2;
    return i === 0 ? sum + area : sum - area;
  }, 0);
}

export function ringCentre(ring: Ring): [number, number] {
  let lng = 0;
  let lat = 0;
  for (const [x, y] of ring) {
    lng += x!;
    lat += y!;
  }
  return [lng / ring.length, lat / ring.length];
}

function pointInRing([x, y]: [number, number], ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi! > y !== yj! > y && x < ((xj! - xi!) * (y - yi!)) / (yj! - yi!) + xi!) inside = !inside;
  }
  return inside;
}

export function pointInPolygons(point: [number, number], polygons: Ring[][]): boolean {
  return polygons.some(
    ([outer, ...holes]) => outer !== undefined && pointInRing(point, outer) && !holes.some((h) => pointInRing(point, h)),
  );
}

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

// Parcel outline as a KML document, for Google Earth, QGIS and similar tools.
export function parcelKml(name: string, polygons: Ring[][]): string {
  const coords = (ring: Ring) => ring.map(([lng, lat]) => `${lng},${lat},0`).join(" ");
  const placemarks = polygons
    .map(([outer, ...holes]) => {
      const inner = holes
        .map((h) => `<innerBoundaryIs><LinearRing><coordinates>${coords(h)}</coordinates></LinearRing></innerBoundaryIs>`)
        .join("");
      return (
        `<Placemark><name>${escapeXml(name)}</name>` +
        `<Style><LineStyle><color>ff2f4fb4</color><width>3</width></LineStyle><PolyStyle><color>402f4fb4</color></PolyStyle></Style>` +
        `<Polygon><outerBoundaryIs><LinearRing><coordinates>${coords(outer ?? [])}</coordinates></LinearRing></outerBoundaryIs>${inner}</Polygon>` +
        `</Placemark>`
      );
    })
    .join("");
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${escapeXml(name)}</name>${placemarks}</Document></kml>\n`
  );
}
