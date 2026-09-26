// Geometry helpers shared between the LKMP forest-cutting-permit ingestion
// script (apps/server/src/scripts/refresh-lkmp-permits.ts) and the request-time
// query service (lkmp-service.ts) — kept in one place so the bbox encoding used
// while writing rows matches the bbox filter used while reading them.

export type Ring = number[][];
export type BBox = { minLng: number; minLat: number; maxLng: number; maxLat: number };

export type LkmpGeometry =
  | { type: "Polygon"; coordinates: Ring[] }
  | { type: "MultiPolygon"; coordinates: Ring[][] };

export function ringBbox(ring: Ring, into: BBox): void {
  for (const point of ring) {
    const lng = point[0]!, lat = point[1]!;
    if (lng < into.minLng) into.minLng = lng;
    if (lat < into.minLat) into.minLat = lat;
    if (lng > into.maxLng) into.maxLng = lng;
    if (lat > into.maxLat) into.maxLat = lat;
  }
}

export function emptyBbox(): BBox {
  return { minLng: Infinity, minLat: Infinity, maxLng: -Infinity, maxLat: -Infinity };
}

export function geometryPolygons(geometry: LkmpGeometry): Ring[][] {
  return geometry.type === "MultiPolygon" ? geometry.coordinates : [geometry.coordinates];
}

export function geometryBbox(geometry: LkmpGeometry): BBox {
  const bbox = emptyBbox();
  for (const polygon of geometryPolygons(geometry)) {
    const outer = polygon[0];
    if (outer) ringBbox(outer, bbox);
  }
  return bbox;
}

// Ray-casting point-in-polygon (same algorithm used for the GRPK/OSP address join
// in connectors.ts — duplicated locally since that one isn't exported).
function pointInRing(point: [number, number], ring: Ring): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]![0]!, yi = ring[i]![1]!;
    const xj = ring[j]![0]!, yj = ring[j]![1]!;
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

// Standard orientation-based segment intersection test, so two polygons that
// overlap only along a sliver (no vertex of either inside the other) still
// count as intersecting.
function orientation(a: number[], b: number[], c: number[]): number {
  const val = (b[1]! - a[1]!) * (c[0]! - b[0]!) - (b[0]! - a[0]!) * (c[1]! - b[1]!);
  if (val === 0) return 0;
  return val > 0 ? 1 : 2;
}

function onSegment(a: number[], b: number[], c: number[]): boolean {
  return (
    Math.min(a[0]!, c[0]!) <= b[0]! && b[0]! <= Math.max(a[0]!, c[0]!) &&
    Math.min(a[1]!, c[1]!) <= b[1]! && b[1]! <= Math.max(a[1]!, c[1]!)
  );
}

function segmentsIntersect(p1: number[], p2: number[], p3: number[], p4: number[]): boolean {
  const o1 = orientation(p1, p2, p3);
  const o2 = orientation(p1, p2, p4);
  const o3 = orientation(p3, p4, p1);
  const o4 = orientation(p3, p4, p2);

  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(p1, p3, p2)) return true;
  if (o2 === 0 && onSegment(p1, p4, p2)) return true;
  if (o3 === 0 && onSegment(p3, p1, p4)) return true;
  if (o4 === 0 && onSegment(p3, p2, p4)) return true;
  return false;
}

function ringsIntersect(ringA: Ring, ringB: Ring): boolean {
  for (const point of ringA) {
    if (pointInRing(point as [number, number], ringB)) return true;
  }
  for (const point of ringB) {
    if (pointInRing(point as [number, number], ringA)) return true;
  }
  for (let i = 0; i < ringA.length - 1; i++) {
    for (let j = 0; j < ringB.length - 1; j++) {
      if (segmentsIntersect(ringA[i]!, ringA[i + 1]!, ringB[j]!, ringB[j + 1]!)) return true;
    }
  }
  return false;
}

export function geometryIntersectsRing(geometry: LkmpGeometry, parcelRing: Ring): boolean {
  for (const polygon of geometryPolygons(geometry)) {
    const outer = polygon[0];
    if (outer && ringsIntersect(outer, parcelRing)) return true;
  }
  return false;
}

// "4177/0100:369" -> "417701000369" (matches the numeric encoding used by the
// data.gov.lt forest dataset — same padding lesson: normalize before comparing,
// never compare raw strings).
export function toDigitsCadastralKey(cadastralRegNo: string): string | undefined {
  const match = cadastralRegNo.match(
    /^(?<area>\d{4})[\s/-]*(?<block>\d{1,4})[\s:/-]*(?<plot>\d{1,4})$/,
  );
  if (!match?.groups) return undefined;
  const { area, block, plot } = match.groups;
  return `${area}${block.padStart(4, "0")}${plot.padStart(4, "0")}`;
}
