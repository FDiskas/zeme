---
name: mobile-coverage-rrt
description: RRT mobile coverage (GSM/UMTS/LTE/5G per operator + LTE/5G speed classes) is OPEN and point-queryable via geoportal RRT_duomenys MapServer (raster layers, identify + export, CORS *).
keywords: [5G, LTE, mobilusis ryšys, aprėptis, rrt, telia, bitė, tele2, sparta, internetas, geoportal, raster, identify]
updated: 2026-10-26
---

### Rule / Fact

`https://www.geoportal.lt/mapproxy/rest/services/gisc_geoportal_public/RRT_duomenys/MapServer` (keyless, capabilities Map,Query,Data, native SR 3346, `Access-Control-Allow-Origin: *`). Verified live 2026-10-26.

- **5G signal per operator:** layers 30 = BITĖ, 31 = TELIA, 32 = TELE2. Legend: Bitė/Telia −95 strong / −105 / −115 weak dBm; Tele2 uses −90 / −100 / −110. NoData = no 5G.
- **LTE/5G speed classes:** 15/16 = BITĖ, 17/18 = TELE2, 19/20 = TELIA (10 % vs 50 % network load = "piko metu"). Pixel value 5 / 30 / 100 / 300 = 5–30, 30–100, 100–300, >300 Mb/s.
- Also LTE 25–27, UMTS 28–29, GSM 22–24, plus fixed-broadband household layers 0–13.
- All are **Raster Layers** (no fields). Point value: `/identify?geometry=lon,lat&geometryType=esriGeometryPoint&sr=4326&layers=all:30,31,32&tolerance=1&mapExtent=…&imageDisplay=…&f=json` → `attributes["Pixel Value"]` ('-95', 'NoData'). Image: `/export?bbox=…&bboxSR=4326&imageSR=3857&layers=show:31&transparent=true&format=png32&f=image`. Grid cell ≈ 100 m.
- RRT's palette is counter-intuitive (strong 5G = red, weak = blue). The user chose to keep RRT's colours on the map and explain them in a legend, rather than recolour.

### Context & Why

The user wants the parcel report to show 5G availability per operator (mock: overall score + Telia/Bitė/Tele2 rows with signal and speed, plus a coloured grid on the map). The data.gov.lt entries (e.g. dataset 3403, SSVA-published) only point to this MapServer. RRT recalculates the maps 1–2× a year from operator-submitted data, using a theoretical propagation model (ITU-R P.525), so present the result as "tikėtina aprėptis", never as measured signal.

### Practical Impact

INTEGRATED on the map as a third base key "5G" (`createCoverageLayer` in apps/web/src/lib/basemap.ts): street map + the chosen operator's raster through the export endpoint, in RRT's own colours (strong #ff7f7f, medium #ffff74, weak #74b3ff, no colour = no 5G, same for all operators) at 0.6 opacity, with an operator/legend panel where the ortho year slider sits. Operator choice in sessionStorage `zeme-coverage-operator`. Tiles answer in about 0.1 s. A report panel with per-parcel numbers is not built yet.

Per-parcel share ("silpnas 82 %, vidutinis 18 %") = sample identify on points inside the polygon, or export the parcel bbox and count pixel classes inside the polygon. Fits the live-query panel pattern in [[neighbourhood-data-sources]] (broadband panel already uses RRT fixed-network data).
