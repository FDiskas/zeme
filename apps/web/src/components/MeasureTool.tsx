import { useEffect, useState } from "react";
import L, { type LatLng, type LeafletMouseEvent, type Map as LeafletMap } from "leaflet";
import { RulerIcon, UndoIcon } from "./icons";

// Lithuanian style: whole metres up close, kilometres with two decimals further on.
function formatDistance(m: number): string {
  if (m < 10) return `${m.toLocaleString("lt-LT", { maximumFractionDigits: 1 })}\u00a0m`;
  if (m < 1000) return `${Math.round(m).toLocaleString("lt-LT")}\u00a0m`;
  return `${(m / 1000).toLocaleString("lt-LT", { maximumFractionDigits: 2 })}\u00a0km`;
}

function pathLength(points: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += points[i - 1]!.distanceTo(points[i]!);
  return total;
}

// A key under the zoom keys that turns the map into a ruler: each click drops
// a point, the line runs through them and the total shows beside the key.
// While it is on, parcels ignore clicks (index.css, .is-measuring) so a click
// never leaves the page; the key again or Esc puts the ruler away.
export function MeasureTool({ map }: { map: LeafletMap | null }) {
  const [active, setActive] = useState(false);
  const [points, setPoints] = useState<LatLng[]>([]);

  function close() {
    setActive(false);
    setPoints([]);
  }

  useEffect(() => {
    if (!map || !active) return;
    const container = map.getContainer();
    const onClick = (event: LeafletMouseEvent) => setPoints((prev) => [...prev, event.latlng]);
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setActive(false);
      setPoints([]);
    };
    container.classList.add("is-measuring");
    // A quick second click is the next point, not a zoom.
    map.doubleClickZoom.disable();
    map.on("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      container.classList.remove("is-measuring");
      map.doubleClickZoom.enable();
      map.off("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [map, active]);

  useEffect(() => {
    if (!map || points.length === 0) return;
    const drawing = L.layerGroup();
    if (points.length > 1) L.polyline(points, { weight: 3, interactive: false, className: "map-measure-line" }).addTo(drawing);
    for (const point of points) {
      L.circleMarker(point, { radius: 5, weight: 2, interactive: false, className: "map-measure-point" }).addTo(drawing);
    }
    drawing.addTo(map);
    return () => {
      drawing.remove();
    };
  }, [map, points]);

  return (
    <div className="flex items-start gap-2">
      <button
        type="button"
        aria-pressed={active}
        aria-label="Matuoti atstumą"
        title="Matuoti atstumą"
        disabled={!map}
        onClick={() => (active ? close() : setActive(true))}
        className="btn btn--secondary btn--icon"
      >
        <RulerIcon className="h-5 w-5" />
      </button>
      {active ? (
        <div className="map-panel">
          <div className="flex items-center gap-3">
            <div className="grid min-w-28">
              <span className="text-xs text-muted">Atstumas</span>
              <output aria-live="polite" className="text-md font-medium whitespace-nowrap text-ink tabular-nums">
                {points.length < 2 ? "Spustelėkite tašką" : formatDistance(pathLength(points))}
              </output>
            </div>
            <button
              type="button"
              aria-label="Atšaukti paskutinį tašką"
              title="Atšaukti paskutinį tašką"
              disabled={points.length === 0}
              onClick={() => setPoints((prev) => prev.slice(0, -1))}
              className="btn btn--secondary btn--icon"
            >
              <UndoIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
