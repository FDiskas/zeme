import { MapContainer, Polygon, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Map as LeafletMap } from "leaflet";
import type { ParcelReport } from "@zeme/shared";
import { getParcelsByBbox } from "../lib/orpc";
import {
  ESRI_IMAGERY,
  ORTHO_YEARS,
  OSM_TILES,
  createOrt10ltLayer,
  orthoYearById,
  useBasemap,
  useOrthoYear,
  type Basemap,
  type OrthoYear,
  type OrthoYearId,
} from "../lib/basemap";
import { CrosshairIcon, LayersIcon } from "./icons";
import "leaflet/dist/leaflet.css";

type BuildingShape = {
  ring: [number, number][];
  label: string | null;
};

type NeighborShape = {
  ring: [number, number][];
  cadastralRegNo: string;
};

type Props = {
  report: ParcelReport;
};

function toLatLngPath(report: ParcelReport): [number, number][] {
  const ring = report.coordinates.coordinates[0] ?? [];

  return ring.map(([lng, lat]) => [lat, lng]);
}

// Each building footprint -> Leaflet positions (outer ring, [lng, lat] -> [lat, lng])
// plus a human-readable label from the spatial join (address, area, floors, year).
function toBuildingShapes(report: ParcelReport): BuildingShape[] {
  return (report.buildings ?? [])
    .map((b) => {
      const ring = (b.geometry.coordinates[0] ?? []).map(
        ([lng, lat]) => [lat, lng] as [number, number],
      );
      const parts: string[] = [];
      if (b.address) parts.push(b.address);
      if (b.areaSqM != null) parts.push(`${Math.round(b.areaSqM)} m²`);
      if (b.floors != null) parts.push(`${b.floors} a.`);
      if (b.constructionYear != null) parts.push(`${b.constructionYear} m.`);
      return { ring, label: parts.length ? parts.join(", ") : null };
    })
    .filter((b) => b.ring.length >= 3);
}

// Adjacent parcels -> Leaflet positions, carrying the cadastral number so a click
// can load that parcel's own report.
function toNeighborShapes(report: ParcelReport): NeighborShape[] {
  return (report.neighbors ?? [])
    .map((n) => ({
      ring: (n.geometry.coordinates[0] ?? []).map(
        ([lng, lat]) => [lat, lng] as [number, number],
      ),
      cadastralRegNo: n.cadastralRegNo,
    }))
    .filter((n) => n.ring.length >= 3);
}

// Frame the subject parcel: zoom to its outline (with padding) rather than a
// fixed zoom on one corner. maxZoom keeps tiny urban plots from zooming in too
// far; the fallback handles a single-point geometry.
function frameParcel(map: LeafletMap, positions: [number, number][]) {
  if (positions.length >= 2) {
    let minLat = Infinity, minLng = Infinity, maxLat = -Infinity, maxLng = -Infinity;
    for (const [lat, lng] of positions) {
      if (lat < minLat) minLat = lat;
      if (lng < minLng) minLng = lng;
      if (lat > maxLat) maxLat = lat;
      if (lng > maxLng) maxLng = lng;
    }
    map.fitBounds([[minLat, minLng], [maxLat, maxLng]], { padding: [56, 56], maxZoom: 18 });
  } else if (positions.length === 1) {
    map.setView(positions[0]!, 17);
  }
}

function FitToParcel({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    frameParcel(map, positions);
  }, [positions, map]);
  return null;
}

// The page sizes the map frame (full screen height on desktop, a share of the
// phone screen), and that size settles after Leaflet has measured it. Re-measure
// whenever the container resizes so the tiles always fill the frame.
function FillContainer() {
  const map = useMap();
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    // Web fonts can shift the layout after the first measure without the map
    // box itself resizing; measure once more when they have settled.
    let active = true;
    document.fonts.ready.then(() => {
      if (active) map.invalidateSize();
    });
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [map]);
  return null;
}

// From the lg breakpoint the parcel map stays put beside the report, so the
// mouse wheel over it zooms the map. Below lg the map sits inside the scrolling
// page, so the wheel keeps scrolling the page and zoom is left to pinch and +/-.
// Follows the window across the breakpoint (resize, rotate).
const WIDE_SCREEN = "(min-width: 64rem)";

function WheelZoomOnWideScreens() {
  const map = useMap();
  useEffect(() => {
    const query = window.matchMedia(WIDE_SCREEN);
    const apply = () => {
      if (query.matches) map.scrollWheelZoom.enable();
      else map.scrollWheelZoom.disable();
    };
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, [map]);
  return null;
}

// The national orthophoto of the chosen years, laid over the Esri imagery once
// the map is close enough for it to matter (see lib/basemap).
function Ort10ltOverlay({ year }: { year: OrthoYear }) {
  const map = useMap();
  useEffect(() => {
    const layer = createOrt10ltLayer(year).addTo(map);
    return () => {
      layer.remove();
    };
  }, [map, year]);
  return null;
}

// The street map, or the orthophoto: Esri underneath so the view is never
// blank, ORT10LT on top for the Lithuanian imagery of the chosen years.
function BaseLayers({ basemap, year }: { basemap: Basemap; year: OrthoYear }) {
  if (basemap === "ortho") {
    return (
      <>
        <TileLayer key="esri" url={ESRI_IMAGERY.url} attribution={ESRI_IMAGERY.attribution} maxNativeZoom={ESRI_IMAGERY.maxNativeZoom} maxZoom={20} zIndex={1} />
        <Ort10ltOverlay year={year} />
      </>
    );
  }
  return <TileLayer key="osm" url={OSM_TILES.url} attribution={OSM_TILES.attribution} maxNativeZoom={OSM_TILES.maxNativeZoom} maxZoom={20} zIndex={1} />;
}

const BASEMAP_OPTIONS: { value: Basemap; label: string }[] = [
  { value: "map", label: "Žemėlapis" },
  { value: "ortho", label: "Ortofoto" },
];

type LayerControlProps = {
  basemap: Basemap;
  onBasemapChange: (next: Basemap) => void;
  yearId: OrthoYearId;
  onYearChange: (next: OrthoYearId) => void;
};

// Over the map's top-right corner: two soft keys for the base layer, the
// chosen one in tangerine. With the orthophoto on, a panel steps through the
// survey years, oldest on the left, the chosen years set large: under the
// keys on wide maps, along the bottom edge on a phone, so it never sits on
// the parcel in the middle. Both choices hold for the visit, on every map.
function MapLayerControl({ basemap, onBasemapChange, yearId, onYearChange }: LayerControlProps) {
  const index = Math.max(0, ORTHO_YEARS.findIndex((year) => year.id === yearId));
  const year = ORTHO_YEARS[index]!;

  return (
    <>
      <div role="group" aria-label="Žemėlapio pagrindas" className="seg absolute top-3 right-3 z-1000">
        <LayersIcon className="ml-2 h-5 w-5 shrink-0 self-center text-muted max-sm:hidden" />
        {BASEMAP_OPTIONS.map((option) => (
          <button key={option.value} type="button" aria-pressed={basemap === option.value} onClick={() => onBasemapChange(option.value)}>
            {option.label}
          </button>
        ))}
      </div>

      {basemap === "ortho" ? (
        <div className="map-panel absolute inset-x-3 bottom-11 z-1000 max-sm:py-2 sm:inset-x-auto sm:top-19 sm:right-3 sm:bottom-auto sm:w-72">
          <label htmlFor="ortho-year" className="flex items-baseline justify-between gap-3 whitespace-nowrap">
            <span className="text-sm text-muted">Nuotraukos metai</span>
            <output htmlFor="ortho-year" className="code text-md text-ink">{year.label}</output>
          </label>
          <input
            id="ortho-year"
            type="range"
            min={0}
            max={ORTHO_YEARS.length - 1}
            step={1}
            value={index}
            aria-valuetext={year.label}
            onChange={(event) => onYearChange(ORTHO_YEARS[Number(event.target.value)]!.id)}
            className="ortho-range"
          />
          <div className="ortho-ticks" aria-hidden="true">
            {ORTHO_YEARS.map((option) => (
              <span key={option.id} />
            ))}
          </div>
          <div className="flex justify-between text-xs text-muted max-sm:hidden" aria-hidden="true">
            <span>{ORTHO_YEARS[0].label.slice(0, 4)}</span>
            <span>Naujausia</span>
          </div>
        </div>
      ) : null}
    </>
  );
}

// Map colours live in index.css (.map-neighbor, .map-parcel, .map-building) so
// they follow the theme tokens; Leaflet only gets stroke weights here. Spread
// these as props, never as pathOptions: Leaflet reads className only when it
// creates the SVG path, and react-leaflet applies pathOptions afterwards via
// setStyle. (Dev hides this: StrictMode re-adds every layer.)
const NEIGHBOR_STYLE = { weight: 1, className: "map-neighbor" };
const PARCEL_STYLE = { weight: 3, className: "map-parcel" };
// A wider ink line under the tangerine edge, so the parcel holds against
// terracotta roofs on the orthophoto and busy streets on the map.
const PARCEL_CASING_STYLE = { weight: 7, interactive: false, className: "map-parcel-casing" };
const BUILDING_STYLE = { weight: 1, className: "map-building" };

// The minimum zoom at which the viewport parcel layer kicks in.
// Below this level there are too many parcels to load and show usefully.
const MIN_ZOOM_FOR_VIEWPORT = 15;

type ViewportShape = { cadastralRegNo: string; ring: [number, number][] };

// Loads all parcel outlines visible in the current map bounds whenever the user
// pans or zooms (debounced). Each polygon is directly clickable — no server
// coordinate-lookup needed since we already know its cadastral number.
function ViewportParcelsLayer({
  excludeIds,
  onNavigate,
}: {
  excludeIds: ReadonlySet<string>;
  onNavigate: (cadastralRegNo: string) => void;
}) {
  const [shapes, setShapes] = useState<ViewportShape[]>([]);
  const genRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const map = useMapEvents({
    moveend: schedule,
    zoomend: schedule,
  });

  function schedule() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { void loadParcels(); }, 400);
  }

  async function loadParcels() {
    const gen = ++genRef.current;
    if (map.getZoom() < MIN_ZOOM_FOR_VIEWPORT) {
      setShapes([]);
      return;
    }
    const b = map.getBounds();
    try {
      const results = await getParcelsByBbox({
        minLat: b.getSouth(),
        minLng: b.getWest(),
        maxLat: b.getNorth(),
        maxLng: b.getEast(),
      });
      if (gen !== genRef.current) return; // stale response — a newer load is in flight
      setShapes(
        results
          .filter((p) => !excludeIds.has(p.cadastralRegNo))
          .map((p) => ({
            cadastralRegNo: p.cadastralRegNo,
            ring: (p.geometry.coordinates[0] ?? []).map(([lng, lat]) => [lat, lng] as [number, number]),
          }))
          .filter((s) => s.ring.length >= 3),
      );
    } catch {
      // Silent fail — the user sees fewer clickable polygons but everything still works.
    }
  }

  useEffect(() => {
    schedule();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {shapes.map((s) => (
        <Polygon
          key={s.cadastralRegNo}
          positions={s.ring}
          {...NEIGHBOR_STYLE}
          eventHandlers={{
            click: () => onNavigate(s.cadastralRegNo),
          }}
        >
          <Tooltip sticky>
            {s.cadastralRegNo}
            <span className="block text-muted">Spustelėkite, kad pamatytumėte ataskaitą</span>
          </Tooltip>
        </Polygon>
      ))}
    </>
  );
}

// Lithuania's rough geographic centre — a reasonable default view for
// browsing the whole country before the user has picked anything.
const LITHUANIA_CENTER: [number, number] = [55.33, 23.88];
const LITHUANIA_ZOOM = 8;

// Shows a "zoom in to see parcels" hint whenever the map is zoomed out past the
// viewport layer's threshold, since ViewportParcelsLayer silently renders
// nothing there and the user otherwise has no clue why.
function ZoomHint() {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());
  useMapEvents({
    zoomend: () => setZoom(map.getZoom()),
  });

  if (zoom >= MIN_ZOOM_FOR_VIEWPORT) return null;
  return (
    <div className="pointer-events-none absolute top-19 left-1/2 z-1000 sm:top-auto sm:bottom-10 w-max max-w-[calc(100%-7rem)] -translate-x-1/2 rounded-pill bg-ink px-4 py-2 text-center text-sm font-medium text-paper">
      Priartinkite žemėlapį, kad pamatytumėte sklypus
    </div>
  );
}

// A full-country map for free browsing: no subject parcel, just the viewport
// layer so panning/zooming around Lithuania reveals clickable sklypai.
export function ExploreMap() {
  const navigate = useNavigate();
  const [basemap, setBasemap] = useBasemap();
  const [yearId, setYearId] = useOrthoYear();

  function navigateToParcel(cadastralRegNo: string) {
    navigate(`/parcel/${encodeURIComponent(cadastralRegNo)}`);
  }

  return (
    <div
      data-basemap={basemap}
      className="-mx-(--gutter) flex min-h-96 flex-1 flex-col overflow-hidden isolate border-y border-rule bg-plate md:mx-0 md:rounded-card md:border"
    >
      <div className="relative min-h-0 flex-1">
        <MapContainer center={LITHUANIA_CENTER} zoom={LITHUANIA_ZOOM} maxZoom={20} className="h-full w-full">
          <FillContainer />
          <ZoomHint />
          <ViewportParcelsLayer excludeIds={EMPTY_IDS} onNavigate={navigateToParcel} />
          <BaseLayers basemap={basemap} year={orthoYearById(yearId)} />
        </MapContainer>
        <MapLayerControl basemap={basemap} onBasemapChange={setBasemap} yearId={yearId} onYearChange={setYearId} />
      </div>
    </div>
  );
}

const EMPTY_IDS: ReadonlySet<string> = new Set();

// Empty-map clicks on a polygon ask the server which parcel is underneath.
// Leaflet doesn't fire map `click` for clicks that land on an interactive layer,
// so clicking a neighbour/your parcel still uses that layer's own handler.
export function ParcelMap({ report }: Props) {
  const navigate = useNavigate();
  const [basemap, setBasemap] = useBasemap();
  const [yearId, setYearId] = useOrthoYear();
  const [map, setMap] = useState<LeafletMap | null>(null);
  const polygon = toLatLngPath(report);
  const buildings = toBuildingShapes(report);
  const neighbors = toNeighborShapes(report);

  // IDs already rendered as their own layers — the viewport layer skips these
  // to avoid duplicate polygons on top of existing neighbors / the main parcel.
  const excludeIds = new Set([
    report.cadastralRegNo,
    ...(report.neighbors ?? []).map((n) => n.cadastralRegNo),
  ]);

  function navigateToParcel(cadastralRegNo: string) {
    navigate(`/parcel/${encodeURIComponent(cadastralRegNo)}`);
  }

  if (polygon.length === 0) {
    return (
      <div className="frame flex min-h-48 items-center p-6 text-md text-ink-2 lg:h-full">
        Šio sklypo vietos žemėlapyje parodyti negalime, nes viešuose duomenų šaltiniuose nėra jo ribų.
      </div>
    );
  }

  const center = polygon[0]!;
  const hasBuildings = buildings.length > 0;

  // Mobile: the map runs edge to edge under the header with the legend below
  // it. Desktop: the page makes this frame the full height of the screen and
  // the legend floats over the map's lower-left corner. The base switch sits
  // top right, the recentre key under Leaflet's zoom keys.
  return (
    <div
      data-basemap={basemap}
      className="-mx-(--gutter) flex flex-col overflow-hidden isolate border-y border-rule bg-plate md:mx-0 md:rounded-card md:border lg:h-full"
    >
      <div className="relative h-[52svh] min-h-80 w-full lg:h-auto lg:min-h-0 lg:flex-1">
        <MapContainer ref={setMap} center={center} zoom={16} maxZoom={20} scrollWheelZoom={false} className="h-full w-full">
          <WheelZoomOnWideScreens />
          <FillContainer />
          <FitToParcel positions={polygon} />
          <ZoomHint />
          <ViewportParcelsLayer excludeIds={excludeIds} onNavigate={navigateToParcel} />
          <BaseLayers basemap={basemap} year={orthoYearById(yearId)} />

          {/* Neighbours first so they sit beneath the subject parcel and its buildings. */}
          {neighbors.map((n) => (
            <Polygon
              key={n.cadastralRegNo}
              positions={n.ring}
              {...NEIGHBOR_STYLE}
              eventHandlers={{
                click: () => navigateToParcel(n.cadastralRegNo),
              }}
            >
              <Tooltip sticky>
                {n.cadastralRegNo}
                <span className="block text-muted">Spustelėkite, kad pamatytumėte ataskaitą</span>
              </Tooltip>
            </Polygon>
          ))}

          {polygon.length >= 3 ? (
            <>
              <Polygon {...PARCEL_CASING_STYLE} positions={polygon} />
              <Polygon {...PARCEL_STYLE} positions={polygon} />
            </>
          ) : null}

          {buildings.map((b, i) => (
            <Polygon
              key={i}
              {...BUILDING_STYLE}
              positions={b.ring}
            >
              {b.label ? <Tooltip sticky>{b.label}</Tooltip> : null}
            </Polygon>
          ))}
        </MapContainer>

        <MapLayerControl basemap={basemap} onBasemapChange={setBasemap} yearId={yearId} onYearChange={setYearId} />

        <button
          type="button"
          onClick={() => map && frameParcel(map, polygon)}
          aria-label="Centruoti sklypą"
          title="Centruoti sklypą"
          className="btn btn--secondary btn--icon absolute top-27 left-[10px] z-1000"
        >
          <CrosshairIcon className="h-5 w-5" />
        </button>

        {/* Legend so the colours on the map mean something at a glance. */}
        {/* Desktop shapes carry their own "spustelėkite" tooltip, so the floating
            legend stays short and covers as little of the map as it can. */}
        <ul className="pointer-events-none absolute bottom-3 left-3 z-1000 hidden gap-1 rounded-pill border border-rule bg-plate px-4 py-3 text-sm text-ink lg:grid">
          <MapLegendItems hasBuildings={hasBuildings} neighborHint={false} />
        </ul>
      </div>

      <ul className="flex flex-wrap gap-x-6 gap-y-2 border-t border-rule px-(--gutter) py-3 text-sm text-ink md:px-4 lg:hidden">
        <MapLegendItems hasBuildings={hasBuildings} neighborHint />
      </ul>
    </div>
  );
}

function MapLegendItems({ hasBuildings, neighborHint }: { hasBuildings: boolean; neighborHint: boolean }) {
  return (
    <>
      <li className="flex items-center gap-2">
        <span className="inline-block h-4 w-4 shrink-0 rounded-[3px] border-2 border-accent bg-accent-soft" aria-hidden="true" />
        Jūsų sklypas
      </li>
      {hasBuildings ? (
        <li className="flex items-center gap-2">
          <span className="inline-block h-4 w-4 shrink-0 rounded-[3px] border border-ink bg-ink-2/40" aria-hidden="true" />
          Pastatai
        </li>
      ) : null}
      <li className="flex items-center gap-2">
        <span className="inline-block h-4 w-4 shrink-0 rounded-[3px] border border-dashed border-ink-2 bg-paper" aria-hidden="true" />
        {neighborHint ? "Gretimi sklypai: spustelėkite, kad atidarytumėte" : "Gretimi sklypai"}
      </li>
    </>
  );
}
