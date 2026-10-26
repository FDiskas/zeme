import L from "leaflet";
import { useSessionStorage } from "./useLocalStorage";

export type Basemap = "map" | "ortho";

const BASEMAP_KEY = "zeme-basemap";
const ORTHO_YEAR_KEY = "zeme-ortho-year";

/** The base-layer choice, shared by every map in the app. Kept for the visit
 *  only, so each new visit opens on the street map. */
export function useBasemap() {
  return useSessionStorage<Basemap>(BASEMAP_KEY, "map");
}

// The orthophoto series NŽT publishes on geoportal.lt, oldest first, so the
// year slider reads left to right through time. "Naujausia" is the cached
// layer of the most recent flights.
export const ORTHO_YEARS = [
  { id: "1995", label: "1995-2001", service: "ORT10LT_1995_2001" },
  { id: "2005", label: "2005-2006", service: "ORT10LT_2005_2006" },
  { id: "2009", label: "2009-2010", service: "ORT10LT_2009_2010" },
  { id: "2012", label: "2012-2013", service: "ORT10LT_2012_2013" },
  { id: "2015", label: "2015", service: "ORT10LT_2015" },
  { id: "2018", label: "2018-2020", service: "ORT10LT_2018_2020" },
  { id: "2021", label: "2021-2023", service: "ORT10LT_2021_2023" },
  { id: "2024", label: "2024-2026", service: "ORT10LT_2024_2026" },
  { id: "latest", label: "Naujausia", service: "ORT10LT_Web_Mercator_102100" },
] as const;

export type OrthoYear = (typeof ORTHO_YEARS)[number];
export type OrthoYearId = OrthoYear["id"];

/** Which orthophoto series the maps show; the newest unless the reader moves the slider. */
export function useOrthoYear() {
  return useSessionStorage<OrthoYearId>(ORTHO_YEAR_KEY, "latest");
}

export function orthoYearById(id: OrthoYearId): OrthoYear {
  return ORTHO_YEARS.find((year) => year.id === id) ?? ORTHO_YEARS[ORTHO_YEARS.length - 1]!;
}

export const OSM_TILES = {
  url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  maxNativeZoom: 19,
};

// Esri World Imagery: fast worldwide tiles, so the orthophoto view is never
// blank while the national imagery loads, and covers the zoomed-out view.
export const ESRI_IMAGERY = {
  url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  attribution: "Esri World Imagery",
  maxNativeZoom: 19,
};

// The national orthophoto (ORT10LT, Nacionalinė žemės tarnyba) via geoportal.lt.
// Its cached tiles sit on grids offset from the web-mercator one (and the
// older series are in LKS-94), so each Leaflet tile asks the service's export
// endpoint for exactly its own box, reprojected on the server.
const GEOPORTAL_NZT = "https://www.geoportal.lt/arcgis/rest/services/NZT";
const LITHUANIA_BOUNDS = L.latLngBounds([53.85, 20.9], [56.46, 26.9]);
const HALF_WORLD_M = 20037508.342789244;

class Ort10ltLayer extends L.TileLayer {
  private readonly exportUrl: string;

  constructor(service: string, options: L.TileLayerOptions) {
    super("", options);
    this.exportUrl = `${GEOPORTAL_NZT}/${service}/MapServer/export`;
  }

  getTileUrl(coords: L.Coords): string {
    const span = (2 * HALF_WORLD_M) / 2 ** coords.z;
    const minX = -HALF_WORLD_M + coords.x * span;
    const maxY = HALF_WORLD_M - coords.y * span;
    const bbox = [minX, maxY - span, minX + span, maxY].map((v) => v.toFixed(2)).join(",");
    const px = L.Browser.retina ? 512 : 256;
    return `${this.exportUrl}?bbox=${bbox}&bboxSR=3857&imageSR=3857&size=${px},${px}&format=jpg&f=image`;
  }
}

/** One ORT10LT series, drawn over Esri from zoom 12, inside Lithuania only. */
export function createOrt10ltLayer(year: OrthoYear): L.TileLayer {
  return new Ort10ltLayer(year.service, {
    minZoom: 12,
    maxZoom: 20,
    bounds: LITHUANIA_BOUNDS,
    attribution: `Ortofoto ${year.id === "latest" ? "" : `${year.label} `}&copy; <a href="https://www.geoportal.lt">NŽT, geoportal.lt</a>`,
    // Above the Esri layer, whatever order the two are added in.
    zIndex: 2,
  });
}
