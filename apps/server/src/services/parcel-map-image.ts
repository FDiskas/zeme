import type { ParcelReport } from "@zeme/shared";

// Static map cut-out for the PDF: OpenStreetMap tiles (the web map's basemap)
// stitched behind an SVG overlay of the parcel, its buildings and neighbours,
// framed at the zoom that fits the parcel. Tiles are fetched here and inlined
// as data URIs so Chromium renders the PDF without any network waits.

type LngLat = [number, number];
type Pixel = [number, number];

const TILE_SIZE = 256;
const TILE_URL = "https://tile.openstreetmap.org";
const TILE_TIMEOUT_MS = 8000;
// ~170 mm × 96 mm: the full A4 content width at 96 dpi.
const FRAME_WIDTH = 640;
const FRAME_HEIGHT = 360;
const FRAME_PADDING = 48;
const MIN_ZOOM = 3;
const MAX_ZOOM = 18;
const EARTH_CIRCUMFERENCE_M = 40_075_016.686;
const SCALE_BAR_MAX_PX = 120;
const SCALE_STEPS_M = [5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];

// Mirrors the web map's theme tokens (map-parcel / map-building / map-neighbor).
const PARCEL_STROKE = "#047857";
const PARCEL_FILL = "#34c084";
const BUILDING_STROKE = "#b45309";
const BUILDING_FILL = "#f59e0b";
const NEIGHBOR_STROKE = "#6b7a72";
const NEIGHBOR_FILL = "#cbd6cf";

// Web Mercator: [lng, lat] -> world pixel at the given zoom.
function project([lng, lat]: LngLat, zoom: number): Pixel {
  const worldSize = TILE_SIZE * 2 ** zoom;
  const sin = Math.sin((lat * Math.PI) / 180);
  return [
    ((lng + 180) / 360) * worldSize,
    (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * worldSize,
  ];
}

function outerRing(geometry: { coordinates: number[][][] }): LngLat[] {
  return (geometry.coordinates[0] ?? []).map(([lng, lat]) => [lng!, lat!]);
}

// Highest zoom at which the parcel's bounding box fits inside the padded frame.
function fitZoom(ring: LngLat[]): number {
  const usableWidth = FRAME_WIDTH - 2 * FRAME_PADDING;
  const usableHeight = FRAME_HEIGHT - 2 * FRAME_PADDING;

  for (let zoom = MAX_ZOOM; zoom > MIN_ZOOM; zoom--) {
    const points = ring.map((point) => project(point, zoom));
    const xs = points.map(([x]) => x);
    const ys = points.map(([, y]) => y);
    if (
      Math.max(...xs) - Math.min(...xs) <= usableWidth &&
      Math.max(...ys) - Math.min(...ys) <= usableHeight
    ) {
      return zoom;
    }
  }
  return MIN_ZOOM;
}

async function fetchTile(zoom: number, x: number, y: number): Promise<string | null> {
  try {
    const response = await fetch(`${TILE_URL}/${zoom}/${x}/${y}.png`, {
      // OSM tile policy requires an identifying User-Agent.
      headers: { "User-Agent": "ZemeServer/1.0 (reginfo.lt)" },
      signal: AbortSignal.timeout(TILE_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    return `data:image/png;base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

function toSvgPath(ring: LngLat[], zoom: number, origin: Pixel): string {
  const commands = ring.map((point, index) => {
    const [x, y] = project(point, zoom);
    return `${index === 0 ? "M" : "L"}${(x - origin[0]).toFixed(1)} ${(y - origin[1]).toFixed(1)}`;
  });
  return `${commands.join(" ")} Z`;
}

function renderScaleBar(lat: number, zoom: number): string {
  const metersPerPixel =
    (EARTH_CIRCUMFERENCE_M * Math.cos((lat * Math.PI) / 180)) / (TILE_SIZE * 2 ** zoom);
  const meters =
    SCALE_STEPS_M.filter((step) => step / metersPerPixel <= SCALE_BAR_MAX_PX).at(-1) ??
    SCALE_STEPS_M[0]!;
  const label = meters >= 1000 ? `${meters / 1000} km` : `${meters} m`;
  const width = Math.round(meters / metersPerPixel);
  return `<div class="parcel-map__scale"><span style="width:${width}px"></span>${label}</div>`;
}

// Returns an HTML <figure>, or an empty string when the parcel has no outline.
export async function renderParcelMapHtml(report: ParcelReport): Promise<string> {
  const parcel = outerRing(report.coordinates);
  if (parcel.length < 3) return "";

  const buildings = (report.buildings ?? [])
    .map((building) => outerRing(building.geometry))
    .filter((ring) => ring.length >= 3);
  const neighbors = (report.neighbors ?? [])
    .map((neighbor) => outerRing(neighbor.geometry))
    .filter((ring) => ring.length >= 3);

  const zoom = fitZoom(parcel);
  const projected = parcel.map((point) => project(point, zoom));
  const xs = projected.map(([x]) => x);
  const ys = projected.map(([, y]) => y);
  const origin: Pixel = [
    (Math.min(...xs) + Math.max(...xs)) / 2 - FRAME_WIDTH / 2,
    (Math.min(...ys) + Math.max(...ys)) / 2 - FRAME_HEIGHT / 2,
  ];

  const tileCount = 2 ** zoom;
  const tileJobs: Promise<string>[] = [];
  for (let ty = Math.floor(origin[1] / TILE_SIZE); ty * TILE_SIZE < origin[1] + FRAME_HEIGHT; ty++) {
    if (ty < 0 || ty >= tileCount) continue;
    for (let tx = Math.floor(origin[0] / TILE_SIZE); tx * TILE_SIZE < origin[0] + FRAME_WIDTH; tx++) {
      const left = Math.round(tx * TILE_SIZE - origin[0]);
      const top = Math.round(ty * TILE_SIZE - origin[1]);
      const wrappedX = ((tx % tileCount) + tileCount) % tileCount;
      tileJobs.push(
        fetchTile(zoom, wrappedX, ty).then((src) =>
          src ? `<img src="${src}" alt="" style="left:${left}px;top:${top}px">` : "",
        ),
      );
    }
  }
  const tiles = await Promise.all(tileJobs);

  const shapes = [
    ...neighbors.map(
      (ring) =>
        `<path d="${toSvgPath(ring, zoom, origin)}" fill="${NEIGHBOR_FILL}" fill-opacity="0.15" stroke="${NEIGHBOR_STROKE}" stroke-width="1"/>`,
    ),
    `<path d="${toSvgPath(parcel, zoom, origin)}" fill="${PARCEL_FILL}" fill-opacity="0.22" stroke="${PARCEL_STROKE}" stroke-width="3" stroke-linejoin="round"/>`,
    ...buildings.map(
      (ring) =>
        `<path d="${toSvgPath(ring, zoom, origin)}" fill="${BUILDING_FILL}" fill-opacity="0.55" stroke="${BUILDING_STROKE}" stroke-width="1"/>`,
    ),
  ].join("");

  const legend = [
    `<span><i style="background:${PARCEL_FILL}55;border-color:${PARCEL_STROKE}"></i>Sklypas</span>`,
    buildings.length > 0
      ? `<span><i style="background:${BUILDING_FILL}8c;border-color:${BUILDING_STROKE}"></i>Pastatai</span>`
      : "",
    neighbors.length > 0
      ? `<span><i style="background:${NEIGHBOR_FILL}40;border-color:${NEIGHBOR_STROKE}"></i>Gretimi sklypai</span>`
      : "",
  ].join("");

  const centerLat = parcel.reduce((sum, [, lat]) => sum + lat, 0) / parcel.length;

  return `
    <figure class="parcel-map">
      <div class="parcel-map__frame" style="width:${FRAME_WIDTH}px;height:${FRAME_HEIGHT}px">
        ${tiles.join("")}
        <svg viewBox="0 0 ${FRAME_WIDTH} ${FRAME_HEIGHT}" width="${FRAME_WIDTH}" height="${FRAME_HEIGHT}">${shapes}</svg>
        ${renderScaleBar(centerLat, zoom)}
        <div class="parcel-map__attribution">© OpenStreetMap</div>
      </div>
      <figcaption class="parcel-map__legend">${legend}</figcaption>
    </figure>
  `;
}
