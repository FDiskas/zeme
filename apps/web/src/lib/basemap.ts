import { useEffect, useState } from "react";
import L from "leaflet";
import { ORTHO_SERIES_FALLBACK, type OrthoSeries } from "@zeme/shared";
import { getOrthoSeries } from "./orpc";
import { useSessionStorage } from "./useLocalStorage";

export type Basemap = "map" | "ortho" | "coverage";

const BASEMAP_KEY = "zeme-basemap";
const ORTHO_YEAR_KEY = "zeme-ortho-series";
const COVERAGE_OPERATOR_KEY = "zeme-coverage-operator";

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
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> bendraautoriai',
  maxNativeZoom: 19,
};

// Esri World Imagery: fast worldwide tiles, so the orthophoto view is never
// blank while the national imagery loads, and covers the zoomed-out view.
export const ESRI_IMAGERY = {
  url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  attribution: "Šaltinis: Esri, Vantor, Earthstar Geographics ir GIS User Community",
  maxNativeZoom: 19,
};

// The national orthophoto (ORT10LT, Nacionalinė žemės tarnyba) via geoportal.lt.
// Its cached tiles sit on grids offset from the web-mercator one (and the
// older series are in LKS-94), so each Leaflet tile asks the service's export
// endpoint for exactly its own box, reprojected on the server.
const GEOPORTAL_NZT = "https://www.geoportal.lt/arcgis/rest/services/NZT";
const LITHUANIA_BOUNDS = L.latLngBounds([53.85, 20.9], [56.46, 26.9]);
const HALF_WORLD_M = 20037508.342789244;

// A Leaflet tile layer that asks an ArcGIS MapServer's export endpoint for
// each tile's own web-mercator box; `params` picks layers and image format.
class ArcgisExportLayer extends L.TileLayer {
  private readonly exportUrl: string;
  private readonly params: string;

  constructor(exportUrl: string, params: string, options: L.TileLayerOptions) {
    super("", options);
    this.exportUrl = exportUrl;
    this.params = params;
  }

  getTileUrl(coords: L.Coords): string {
    const span = (2 * HALF_WORLD_M) / 2 ** coords.z;
    const minX = -HALF_WORLD_M + coords.x * span;
    const maxY = HALF_WORLD_M - coords.y * span;
    const bbox = [minX, maxY - span, minX + span, maxY].map((v) => v.toFixed(2)).join(",");
    const px = L.Browser.retina ? 512 : 256;
    return `${this.exportUrl}?bbox=${bbox}&bboxSR=3857&imageSR=3857&size=${px},${px}&${this.params}&f=image`;
  }
}

/** One ORT10LT series, drawn over Esri from zoom 12, inside Lithuania only. */
export function createOrt10ltLayer(series: OrthoSeries, isNewest: boolean): L.TileLayer {
  return new ArcgisExportLayer(`${GEOPORTAL_NZT}/${series.service}/MapServer/export`, "format=jpg", {
    minZoom: 12,
    maxZoom: 20,
    bounds: LITHUANIA_BOUNDS,
    attribution: `Ortofoto ${isNewest ? "" : `${series.label} `}&copy; <a href="https://www.geoportal.lt">NŽT, geoportal.lt</a>`,
    // Above the Esri layer, whatever order the two are added in.
    zIndex: 2,
  });
}

// The 5G coverage RRT (Ryšių reguliavimo tarnyba) calculates for each operator,
// published by geoportal.lt as raster layers of about 100 m cells. Drawn in
// RRT's own colours, the same for every operator; no colour means no 5G.
const GEOPORTAL_RRT = "https://www.geoportal.lt/mapproxy/rest/services/gisc_geoportal_public/RRT_duomenys/MapServer/export";

export type CoverageOperator = "telia" | "bite" | "tele2";

export const COVERAGE_OPERATORS: { value: CoverageOperator; label: string; layer: number }[] = [
  { value: "telia", label: "Telia", layer: 31 },
  { value: "bite", label: "Bitė", layer: 30 },
  { value: "tele2", label: "Tele2", layer: 32 },
];

// Tele2 is classed at -90/-100/-110 dBm, the others at -95/-105/-115.
export const COVERAGE_LEGEND = [
  { label: "Stiprus", color: "#ff7f7f" },
  { label: "Vidutinis", color: "#ffff74" },
  { label: "Silpnas", color: "#74b3ff" },
];

// See-through enough that streets and house numbers stay readable beneath.
export const COVERAGE_OPACITY = 0.6;

/** The operator shown on the 5G layer, kept for the visit. */
export function useCoverageOperator() {
  return useSessionStorage<CoverageOperator>(COVERAGE_OPERATOR_KEY, "telia");
}

/** One operator's 5G coverage over the street map, inside Lithuania only. */
export function createCoverageLayer(operator: CoverageOperator): L.TileLayer {
  const layer = COVERAGE_OPERATORS.find((o) => o.value === operator)?.layer ?? COVERAGE_OPERATORS[0]!.layer;
  return new ArcgisExportLayer(GEOPORTAL_RRT, `layers=show:${layer}&transparent=true&format=png32`, {
    maxZoom: 20,
    bounds: LITHUANIA_BOUNDS,
    opacity: COVERAGE_OPACITY,
    attribution: '5G aprėptis &copy; <a href="https://www.rrt.lt/judriojo-rysio-tinklu-tiketinos-aprepties-zonos/">RRT</a>, geoportal.lt',
    zIndex: 2,
  });
}
