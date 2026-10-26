import { useEffect, useState } from "react";
import L from "leaflet";
import { ORTHO_SERIES_FALLBACK, type OrthoSeries } from "@zeme/shared";
import { getOrthoSeries } from "./orpc";
import { useSessionStorage } from "./useLocalStorage";

export type Basemap = "map" | "ortho";

const BASEMAP_KEY = "zeme-basemap";
const ORTHO_YEAR_KEY = "zeme-ortho-series";

/** The base-layer choice, shared by every map in the app. Kept for the visit
 *  only, so each new visit opens on the street map. */
export function useBasemap() {
  return useSessionStorage<Basemap>(BASEMAP_KEY, "map");
}

/** The orthophoto series to offer: the bundled list at first, then the live
 *  one from the server, which reads geoportal.lt, so new flights appear on
 *  their own. */
export function useOrthoSeries(): OrthoSeries[] {
  const [series, setSeries] = useState<OrthoSeries[]>(ORTHO_SERIES_FALLBACK);
  useEffect(() => {
    let active = true;
    getOrthoSeries()
      .then((live) => {
        if (active && live.length > 1) setSeries(live);
      })
      .catch(() => {
        // Server unreachable: the bundled list keeps the slider working.
      });
    return () => {
      active = false;
    };
  }, []);
  return series;
}

/** The chosen series by service name; null follows the newest, so a reader
 *  on "Naujausia" moves on to new flights when they are published. */
export function useOrthoChoice() {
  return useSessionStorage<string | null>(ORTHO_YEAR_KEY, null);
}

/** Index of the chosen series in the list; unknown or null means the newest. */
export function orthoIndex(series: OrthoSeries[], choice: string | null): number {
  const index = choice === null ? -1 : series.findIndex((s) => s.service === choice);
  return index >= 0 ? index : series.length - 1;
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
export function createOrt10ltLayer(series: OrthoSeries, isNewest: boolean): L.TileLayer {
  return new Ort10ltLayer(series.service, {
    minZoom: 12,
    maxZoom: 20,
    bounds: LITHUANIA_BOUNDS,
    attribution: `Ortofoto ${isNewest ? "" : `${series.label} `}&copy; <a href="https://www.geoportal.lt">NŽT, geoportal.lt</a>`,
    // Above the Esri layer, whatever order the two are added in.
    zIndex: 2,
  });
}
