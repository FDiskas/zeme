// Vertex average of a parcel's outer ring — good enough as a parcel "centre"
// for point lookups (locality, nearest places, grid cells): parcels are small
// next to the areas they are looked up in.
export function parcelCentre(geometry: any): [number, number] | null {
  const ring: number[][] | undefined =
    geometry?.type === "Polygon"
      ? geometry.coordinates?.[0]
      : geometry?.type === "MultiPolygon"
        ? geometry.coordinates?.[0]?.[0]
        : undefined;
  if (!ring || ring.length === 0) return null;
  let lon = 0;
  let lat = 0;
  for (const [x, y] of ring) {
    lon += x!;
    lat += y!;
  }
  return [lon / ring.length, lat / ring.length];
}
