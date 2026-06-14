import { MapContainer, Polygon, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ParcelReport } from "@zeme/shared";
import { getParcelsByBbox } from "../lib/orpc";
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
      return { ring, label: parts.length ? parts.join(" · ") : null };
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
function FitToParcel({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length >= 2) {
      let minLat = Infinity, minLng = Infinity, maxLat = -Infinity, maxLng = -Infinity;
      for (const [lat, lng] of positions) {
        if (lat < minLat) minLat = lat;
        if (lng < minLng) minLng = lng;
        if (lat > maxLat) maxLat = lat;
        if (lng > maxLng) maxLng = lng;
      }
      map.fitBounds([[minLat, minLng], [maxLat, maxLng]], { padding: [48, 48], maxZoom: 18 });
    } else if (positions.length === 1) {
      map.setView(positions[0]!, 17);
    }
    // Trigger map invalidation to ensure full-size layout renders perfectly
    setTimeout(() => {
      map.invalidateSize();
    }, 100);
  }, [positions, map]);
  return null;
}

// Map colours follow the theme tokens: neighbours sit quietly in mist, the
// subject parcel is forest (the land), buildings stand out in warm amber.
const NEIGHBOR_STYLE = { color: "#9aa8a0", weight: 1, fillColor: "#cbd6cf", fillOpacity: 0.15, className: "cursor-pointer" };
const NEIGHBOR_HOVER_STYLE = { color: "#047857", weight: 2, fillColor: "#6dd6a8", fillOpacity: 0.35, className: "cursor-pointer" };
const PARCEL_STYLE = { color: "#047857", weight: 3, fillColor: "#34c084", fillOpacity: 0.22 };
const BUILDING_STYLE = { color: "#b45309", weight: 1, fillColor: "#f59e0b", fillOpacity: 0.55 };

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
          pathOptions={NEIGHBOR_STYLE}
          eventHandlers={{
            click: () => onNavigate(s.cadastralRegNo),
            mouseover: (e) => e.target.setStyle(NEIGHBOR_HOVER_STYLE),
            mouseout: (e) => e.target.setStyle(NEIGHBOR_STYLE),
          }}
        >
          <Tooltip sticky>
            {s.cadastralRegNo}
            <span className="block text-mist-500">Spustelėkite, kad pamatytumėte ataskaitą</span>
          </Tooltip>
        </Polygon>
      ))}
    </>
  );
}

// Empty-map clicks on a polygon ask the server which parcel is underneath.
// Leaflet doesn't fire map `click` for clicks that land on an interactive layer,
// so clicking a neighbour/your parcel still uses that layer's own handler.
export function ParcelMap({ report }: Props) {
  const navigate = useNavigate();
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
      <div className="rounded-3xl border border-mist-200 bg-mist-50 p-6 text-lg text-mist-700">
        Šio sklypo vietos žemėlapyje parodyti negalime – viešuose duomenų šaltiniuose nėra jo ribų.
      </div>
    );
  }

  const center = polygon[0]!;
  const hasBuildings = buildings.length > 0;
  const hasNeighbors = neighbors.length > 0;

  return (
    <div className="overflow-hidden rounded-3xl border border-mist-200 bg-white shadow-soft">
      <div className="relative h-96 w-full md:h-130">
        {/* scrollWheelZoom off so scrolling the page over the map doesn't hijack
            into a zoom (desktop) — pinch-zoom + the +/- controls still work on
            touch. Keeps the map cooperative inside a vertically-scrolling page. */}
        <MapContainer center={center} zoom={16} scrollWheelZoom={false} className="h-full w-full">
          <FitToParcel positions={polygon} />
          <ViewportParcelsLayer excludeIds={excludeIds} onNavigate={navigateToParcel} />
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />

          {/* Neighbours first so they sit beneath the subject parcel and its buildings. */}
          {neighbors.map((n) => (
            <Polygon
              key={n.cadastralRegNo}
              positions={n.ring}
              pathOptions={NEIGHBOR_STYLE}
              eventHandlers={{
                click: () => navigateToParcel(n.cadastralRegNo),
                mouseover: (e) => e.target.setStyle(NEIGHBOR_HOVER_STYLE),
                mouseout: (e) => e.target.setStyle(NEIGHBOR_STYLE),
              }}
            >
              <Tooltip sticky>
                {n.cadastralRegNo}
                <span className="block text-mist-500">Spustelėkite, kad pamatytumėte ataskaitą</span>
              </Tooltip>
            </Polygon>
          ))}

          {polygon.length >= 3 ? (
            <Polygon pathOptions={PARCEL_STYLE} positions={polygon} />
          ) : null}

          {buildings.map((b, i) => (
            <Polygon
              key={i}
              pathOptions={BUILDING_STYLE}
              positions={b.ring}
            >
              {b.label ? <Tooltip sticky>{b.label}</Tooltip> : null}
            </Polygon>
          ))}
        </MapContainer>
      </div>

      {/* Legend so the colours on the map mean something at a glance. */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-mist-200 px-5 py-3.5 text-base text-mist-700">
        <span className="flex items-center gap-2">
          <span className="inline-block h-4 w-4 rounded-sm border-2 border-forest-600 bg-forest-400/40" aria-hidden="true" />
          Jūsų sklypas
        </span>
        {hasBuildings ? (
          <span className="flex items-center gap-2">
            <span className="inline-block h-4 w-4 rounded-sm border border-amber-700 bg-amber-200" aria-hidden="true" />
            Pastatai
          </span>
        ) : null}
        {hasNeighbors ? (
          <span className="flex items-center gap-2">
            <span className="inline-block h-4 w-4 rounded-sm border border-mist-400 bg-mist-300/50" aria-hidden="true" />
            Gretimi sklypai – spustelėkite norėdami atidaryti
          </span>
        ) : null}
      </div>

      <p className="border-t border-mist-100 px-5 py-3 text-base text-mist-500">
        Artėjant žemėlapį (zoom ≥ 15) matomi visi aplinkiniai sklypai — spustelėkite bet kurį.
      </p>
    </div>
  );
}
