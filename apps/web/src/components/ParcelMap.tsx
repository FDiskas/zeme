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
      <div className="rounded-2xl border border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
        Parcel geometry is not available from the current public data sources, so no map location can be shown yet.
      </div>
    );
  }

  const center = polygon[0]!;

  return (
    <div className="h-[420px] w-full overflow-hidden rounded-2xl border border-slate-300/70">
      <MapContainer center={center} zoom={16} className="h-full w-full">
        <ChangeMapView center={center} />
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        {polygon.length >= 3 ? (
          <Polygon pathOptions={{ color: "#0d9488", fillOpacity: 0.25 }} positions={polygon} />
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
  );
}

