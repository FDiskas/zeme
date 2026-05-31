import { MapContainer, Polygon, TileLayer, Tooltip, useMap } from "react-leaflet";
import { useEffect } from "react";
import type { ParcelReport } from "@zeme/shared";
import "leaflet/dist/leaflet.css";

type BuildingShape = {
  ring: [number, number][];
  label: string | null;
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

function ChangeMapView({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 16);
    // Trigger map invalidation to ensure full-size layout renders perfectly
    setTimeout(() => {
      map.invalidateSize();
    }, 100);
  }, [center, map]);
  return null;
}

export function ParcelMap({ report }: Props) {
  const polygon = toLatLngPath(report);
  const buildings = toBuildingShapes(report);

  if (polygon.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-300 bg-slate-50 p-6 text-lg text-slate-700">
        Šio sklypo vietos žemėlapyje parodyti negalime – viešuose duomenų šaltiniuose nėra jo ribų.
      </div>
    );
  }

  const center = polygon[0]!;
  const hasBuildings = buildings.length > 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-300/70 bg-white">
      <div className="h-[520px] w-full">
        <MapContainer center={center} zoom={16} className="h-full w-full">
          <ChangeMapView center={center} />
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
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
      </div>
    </div>
  );
}

