import { MapContainer, Polygon, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ParcelReport } from "@zeme/shared";
import { resolveParcelByPoint } from "../lib/orpc";
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

const NEIGHBOR_STYLE = { color: "#94a3b8", weight: 1, fillColor: "#cbd5e1", fillOpacity: 0.15, className: "cursor-pointer" };
const NEIGHBOR_HOVER_STYLE = { color: "#0d9488", weight: 2, fillColor: "#5eead4", fillOpacity: 0.35, className: "cursor-pointer" };

// Empty-map clicks (not on a polygon) ask the server which parcel is underneath.
// Leaflet doesn't fire map `click` for clicks that land on an interactive layer,
// so clicking a neighbour/your parcel still uses that layer's own handler.
function MapClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export function ParcelMap({ report }: Props) {
  const navigate = useNavigate();
  const [resolving, setResolving] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const polygon = toLatLngPath(report);
  const buildings = toBuildingShapes(report);
  const neighbors = toNeighborShapes(report);

  async function handleMapPick(lat: number, lng: number) {
    if (resolving) return;
    setResolving(true);
    setNotFound(false);
    try {
      const result = await resolveParcelByPoint(lat, lng);
      if (result) {
        // Navigation remounts this page, so no need to reset `resolving`.
        navigate(`/parcel/${encodeURIComponent(result.cadastralRegNo)}`);
        return;
      }
      setNotFound(true);
      setTimeout(() => setNotFound(false), 4000);
    } catch {
      setNotFound(true);
      setTimeout(() => setNotFound(false), 4000);
    } finally {
      setResolving(false);
    }
  }

  if (polygon.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-300 bg-slate-50 p-6 text-lg text-slate-700">
        Šio sklypo vietos žemėlapyje parodyti negalime – viešuose duomenų šaltiniuose nėra jo ribų.
      </div>
    );
  }

  const center = polygon[0]!;
  const hasBuildings = buildings.length > 0;
  const hasNeighbors = neighbors.length > 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-300/70 bg-white">
      <div className="relative h-130 w-full">
        {resolving ? (
          <div className="pointer-events-none absolute left-1/2 top-4 z-1000 -translate-x-1/2 rounded-full bg-slate-900/85 px-4 py-2 text-base font-semibold text-white shadow-lg">
            Ieškoma sklypo…
          </div>
        ) : null}
        {notFound ? (
          <div className="pointer-events-none absolute left-1/2 top-4 z-1000 -translate-x-1/2 rounded-full bg-amber-500/95 px-4 py-2 text-base font-semibold text-white shadow-lg">
            Šioje vietoje sklypo nerasta
          </div>
        ) : null}
        <MapContainer center={center} zoom={16} className="h-full w-full">
          <FitToParcel positions={polygon} />
          <MapClickHandler onPick={handleMapPick} />
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
                click: () => navigate(`/parcel/${encodeURIComponent(n.cadastralRegNo)}`),
                mouseover: (e) => e.target.setStyle(NEIGHBOR_HOVER_STYLE),
                mouseout: (e) => e.target.setStyle(NEIGHBOR_STYLE),
              }}
            >
              <Tooltip sticky>
                {n.cadastralRegNo}
                <span className="block text-slate-500">Spustelėkite, kad pamatytumėte ataskaitą</span>
              </Tooltip>
            </Polygon>
          ))}

          {polygon.length >= 3 ? (
            <Polygon pathOptions={{ color: "#0d9488", weight: 3, fillOpacity: 0.2 }} positions={polygon} />
          ) : null}

          {buildings.map((b, i) => (
            <Polygon
              key={i}
              pathOptions={{ color: "#b45309", weight: 1, fillColor: "#f59e0b", fillOpacity: 0.55 }}
              positions={b.ring}
            >
              {b.label ? <Tooltip sticky>{b.label}</Tooltip> : null}
            </Polygon>
          ))}
        </MapContainer>
      </div>

      {/* Legend so the colours on the map mean something at a glance. */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-slate-200 px-5 py-3 text-base text-slate-700">
        <span className="flex items-center gap-2">
          <span className="inline-block h-4 w-4 rounded-sm border-2 border-teal-600 bg-teal-600/20" aria-hidden="true" />
          Jūsų sklypas
        </span>
        {hasBuildings ? (
          <span className="flex items-center gap-2">
            <span className="inline-block h-4 w-4 rounded-sm border border-amber-700 bg-amber-400/70" aria-hidden="true" />
            Pastatai
          </span>
        ) : null}
        {hasNeighbors ? (
          <span className="flex items-center gap-2">
            <span className="inline-block h-4 w-4 rounded-sm border border-slate-400 bg-slate-300/40" aria-hidden="true" />
            Gretimi sklypai – spustelėkite norėdami atidaryti
          </span>
        ) : null}
      </div>

      <p className="border-t border-slate-100 px-5 py-3 text-base text-slate-500">
        Patarimas: spustelėkite bet kurioje žemėlapio vietoje, kad atidarytumėte ten esantį sklypą.
      </p>
    </div>
  );
}
