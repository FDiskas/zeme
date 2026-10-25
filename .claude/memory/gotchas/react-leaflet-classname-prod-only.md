---
name: react-leaflet-classname-prod-only
description: Leaflet className in react-leaflet pathOptions is ignored in production (works in dev only via StrictMode) — spread it as a prop
keywords: [leaflet, react-leaflet, className, pathOptions, strictmode, production, map colours, blue polygons, 3388ff]
updated: 2026-10-26
---

### Rule / Fact

Pass `className` (and the style it pairs with) to `<Polygon>` / other path components as direct props (`{...PARCEL_STYLE}`), never inside `pathOptions`.

### Context & Why

react-leaflet 5 applies `pathOptions` through `setStyle()` after the layer is created; Leaflet reads `className` only in `_initPath` when the SVG path is created. In dev, React StrictMode removes and re-adds every layer, so the path is re-created with the class and everything looks right. In a production build the class never lands, and polygons fall back to Leaflet's default `#3388ff` blue, which doesn't match the legend. This was seen on the deployed reginfo.lt on 2026-10-26.

### Practical Impact

Map colours are CSS classes in apps/web/src/index.css (`.map-parcel`, `.map-building`, `.map-neighbor`). To verify map styling, use a production build (`vite build` + `vite preview`), not the dev server.
