import type { ParcelReport, BuildingFootprint } from "@zeme/shared";
import type { BiipAddressPoint } from "./biip-service";
import type { OspBuildingPoint } from "./osp-service";

export type UpstreamPanel = ParcelReport["reportPanels"][number];

// Ray-casting point-in-polygon on a [lng, lat] outer ring.
function pointInRing(point: [number, number], ring: number[][]): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]![0]!, yi = ring[i]![1]!;
    const xj = ring[j]![0]!, yj = ring[j]![1]!;
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

import {
  resolveParcelFromBiip,
  resolveAddressFromBiip,
  resolveRoomsFromBiip,
  type ResolvedBiipAddresses,
} from "./biip-service";

export async function fetchBiipBoundary(cadastralRegNo: string, address: string): Promise<UpstreamPanel> {
  const parcel = await resolveParcelFromBiip(cadastralRegNo);

  if (parcel) {
    return {
      key: "biip-boundary",
      title: "Boundary & Land Purpose",
      source: "biip.lt",
      status: "ok",
      items: [
        {
          cadastralRegNo: parcel.cadastralRegNo,
          uniqueNumber: parcel.uniqueNumber,
          municipality: parcel.municipalityName,
          municipalityCode: parcel.uniqueNumber ? String(parcel.uniqueNumber).slice(0, 2) : "41",
          areaHectares: parcel.areaHa,
          landPurpose: parcel.purposeGroup || "Kita",
          landUse: parcel.purposeFullName || parcel.purposeName || "Kita (žemės)",
          status: parcel.status || "N/A",
          updatedAt: parcel.updatedAt || "N/A",
          measuredMethod: "Kadastriniai matavimai (LKS-94 coordinate system)",
        },
      ],
    };
  }

  return {
    key: "biip-boundary",
    title: "Boundary & Land Purpose",
    source: "biip.lt",
    status: "error",
    items: [],
    note: `Failed to resolve parcel boundary from BIIP boundaries API for cadastral number: ${cadastralRegNo}`,
  };
}

// Official address points and addressed rooms (apartments/units) intersecting the
// parcel polygon — the buildings/entrances on the parcel as recorded by BIIP.
export async function fetchBiipAddresses(
  cadastralRegNo: string,
  geometry?: any,
  preResolvedAddresses?: ResolvedBiipAddresses | null,
): Promise<UpstreamPanel> {
  let ewkt: string | undefined;
  if (geometry) {
    ewkt = geometryToEwkt(geometry);
  }
  if (!ewkt) {
    const parcel = await resolveParcelFromBiip(cadastralRegNo);
    ewkt = parcel?.ewkt;
  }

  if (!ewkt) {
    return {
      key: "biip-addresses",
      title: "Address Points & Rooms (BIIP)",
      source: "biip.lt",
      status: "error",
      items: [],
      note: `Failed to resolve parcel geometry from BIIP for cadastral number: ${cadastralRegNo}`,
    };
  }

  // Reuse already-resolved addresses (computed once upstream) to avoid a duplicate
  // BIIP call; only rooms still need fetching here.
  const [addresses, rooms] = await Promise.all([
    preResolvedAddresses !== undefined
      ? Promise.resolve(preResolvedAddresses)
      : resolveAddressFromBiip(ewkt),
    resolveRoomsFromBiip(ewkt),
  ]);

  const addressItems = (addresses?.addresses || []).map((a) => ({
    type: "Adreso taškas (Address point)",
    address: a.fullAddress,
    plotOrBuildingNumber: a.plotOrBuildingNumber,
    postalCode: a.postalCode || "N/A",
    coordinates: a.point ? `${a.point[1].toFixed(6)}, ${a.point[0].toFixed(6)}` : "N/A",
  }));

  const roomItems = rooms.map((r) => ({
    type: "Patalpa (Room/Unit)",
    roomNumber: r.roomNumber,
    address: r.fullAddress,
  }));

  const items = [...addressItems, ...roomItems];

  return {
    key: "biip-addresses",
    title: "Address Points & Rooms (BIIP)",
    source: "biip.lt",
    status: "ok",
    items,
    note: items.length === 0
      ? "No registered address points or rooms found on this parcel."
      : `Found ${addressItems.length} address point(s) and ${roomItems.length} addressed room(s) on this parcel.`,
  };
}

function geometryToEwkt(geometry: any): string | undefined {
  if (!geometry || geometry.type !== "Polygon") return undefined;
  const ring = geometry.coordinates?.[0];
  if (!ring || ring.length < 4) return undefined;
  const coords = ring.map(([lon, lat]: [number, number]) => `${lon} ${lat}`).join(", ");
  return `SRID=4326;POLYGON((${coords}))`;
}

function getArcgisGeometry(geometry: any) {
  if (!geometry) return null;
  if (geometry.type === "Polygon") {
    return {
      rings: geometry.coordinates,
      spatialReference: { wkid: 4326 }
    };
  } else if (geometry.type === "MultiPolygon") {
    const rings: any[] = [];
    for (const polyCoords of geometry.coordinates) {
      rings.push(...polyCoords);
    }
    return {
      rings,
      spatialReference: { wkid: 4326 }
    };
  }
  return null;
}

async function queryArcgisLayer(
  serviceUrl: string,
  layerId: number,
  geometry: any,
): Promise<any[]> {
  const arcgisGeom = getArcgisGeometry(geometry);
  if (!arcgisGeom) {
    throw new Error("Invalid or missing geometry for spatial query");
  }

  const url = `${serviceUrl}/${layerId}/query`;
  const params = new URLSearchParams();
  params.append("geometry", JSON.stringify(arcgisGeom));
  params.append("geometryType", "esriGeometryPolygon");
  params.append("spatialRel", "esriSpatialRelIntersects");
  params.append("inSR", "4326");
  params.append("outSR", "4326");
  params.append("outFields", "*");
  params.append("returnGeometry", "false");
  params.append("f", "json");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new Error(`HTTP error ${response.status} from ArcGIS service`);
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.message || "ArcGIS query error");
  }

  return (data.features || []).map((f: any) => f.attributes);
}

export async function fetchGeoportalConstraints(
  cadastralRegNo: string,
  address: string,
  geometry?: any,
): Promise<UpstreamPanel> {
  let geom = geometry;
  if (!geom) {
    const parcel = await resolveParcelFromBiip(cadastralRegNo);
    geom = parcel?.geometry;
  }

  if (!geom) {
    return {
      key: "geoportal-constraints",
      title: "Environmental & Special Land Use Conditions (SŽNS)",
      source: "Valstybinis saugomų teritorijų kadastras (VSTT STVK) via OSP",
      status: "error",
      items: [],
      note: `Failed to resolve parcel boundary coordinates for cadastral number: ${cadastralRegNo}`,
    };
  }

  const serviceUrl = "https://osp-sdg.stat.gov.lt/arcgis/rest/services/vstt_stvk/FeatureServer";
  try {
    const [draustiniai, parkai, rezervatai, buveines, pauksciai] = await Promise.all([
      queryArcgisLayer(serviceUrl, 6, geom).catch(() => []),
      queryArcgisLayer(serviceUrl, 13, geom).catch(() => []),
      queryArcgisLayer(serviceUrl, 15, geom).catch(() => []),
      queryArcgisLayer(serviceUrl, 5, geom).catch(() => []),
      queryArcgisLayer(serviceUrl, 14, geom).catch(() => []),
    ]);

    const items: Record<string, any>[] = [
      ...draustiniai.map(attrs => ({
        type: "Draustinis (Nature/Cultural Reserve)",
        name: attrs.pavadinimas,
        code: attrs.id || attrs.gkodas || "N/A",
      })),
      ...parkai.map(attrs => ({
        type: "Nacionalinis/Regioninis parkas (National/Regional Park)",
        name: attrs.pavadinimas,
        code: attrs.id || attrs.gkodas || "N/A",
      })),
      ...rezervatai.map(attrs => ({
        type: "Rezervatas (Strict Nature Reserve)",
        name: attrs.pavadinimas,
        code: attrs.id || attrs.gkodas || "N/A",
      })),
      ...buveines.map(attrs => ({
        type: "Buveinių apsaugai svarbi teritorija (Habitat Protection Area)",
        name: attrs.pavadinimas,
        code: attrs.id || attrs.gkodas || "N/A",
      })),
      ...pauksciai.map(attrs => ({
        type: "Paukščių apsaugai svarbi teritorija (Birds Protection Area)",
        name: attrs.pavadinimas,
        code: attrs.id || attrs.gkodas || "N/A",
      })),
    ];

    return {
      key: "geoportal-constraints",
      title: "Environmental & Special Land Use Conditions (SŽNS)",
      source: "Valstybinis saugomų teritorijų kadastras (VSTT STVK) via OSP",
      status: "ok",
      items,
      note: items.length === 0
        ? "No protected territories or environmental constraints found intersecting this parcel."
        : `Found ${items.length} environmental constraints / special conditions intersecting this parcel.`,
    };
  } catch (err: any) {
    return {
      key: "geoportal-constraints",
      title: "Environmental & Special Land Use Conditions (SŽNS)",
      source: "Valstybinis saugomų teritorijų kadastras (VSTT STVK) via OSP",
      status: "error",
      items: [],
      note: `Error querying environmental constraints: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export async function fetchKvrData(
  cadastralRegNo: string,
  address: string,
  geometry?: any,
): Promise<UpstreamPanel> {
  let geom = geometry;
  if (!geom) {
    const parcel = await resolveParcelFromBiip(cadastralRegNo);
    geom = parcel?.geometry;
  }

  if (!geom) {
    return {
      key: "kvr-heritage",
      title: "Cultural Heritage Register",
      source: "KVR ArcGIS REST API via OSP",
      status: "error",
      items: [],
      note: `Failed to resolve parcel boundary coordinates for cadastral number: ${cadastralRegNo}`,
    };
  }

  const serviceUrl = "https://osp-sdg.stat.gov.lt/arcgis/rest/services/KPD";
  try {
    const [poligonai, taskai, apsaugosZonos] = await Promise.all([
      queryArcgisLayer(`${serviceUrl}/kvr_poligonai_enriched/FeatureServer`, 0, geom).catch(() => []),
      queryArcgisLayer(`${serviceUrl}/kvr_taskai_enriched/FeatureServer`, 0, geom).catch(() => []),
      queryArcgisLayer(`${serviceUrl}/kvr_apsaugos_zonos/FeatureServer`, 0, geom).catch(() => []),
    ]);

    const items: Record<string, any>[] = [
      ...poligonai.map(attrs => ({
        type: "Kultūros paveldo objektas (Polygon)",
        name: attrs.pavadinimas,
        code: attrs.unikalus_kodas,
        classifier: attrs.klasifikatorius,
        status: attrs.statusas,
        significance: attrs.reiksmingumas,
        address: attrs.adresas,
        age: attrs.amzius,
        link: attrs.nuoroda,
        areaSqM: attrs.Shape__Area ? Number(attrs.Shape__Area).toFixed(2) : "N/A",
      })),
      ...taskai.map(attrs => ({
        type: "Kultūros paveldo objektas (Point)",
        name: attrs.pavadinimas,
        code: attrs.unikalus_kodas,
        classifier: attrs.klasifikatorius,
        status: attrs.statusas,
        significance: attrs.reiksmingumas,
        address: attrs.adresas,
        age: attrs.amzius,
        link: attrs.nuoroda,
      })),
      ...apsaugosZonos.map(attrs => ({
        type: "Apsaugos zona (Protection Zone)",
        name: attrs.pavadinimas || `Apsaugos zona: ${attrs.unikalus_kodas}`,
        code: attrs.unikalus_kodas,
        classifier: attrs.klasifikatorius,
        status: attrs.statusas,
        zoneType: attrs.pozonis,
        areaSqM: attrs.Shape__Area ? Number(attrs.Shape__Area).toFixed(2) : "N/A",
      })),
    ];

    return {
      key: "kvr-heritage",
      title: "Cultural Heritage Register",
      source: "KVR ArcGIS REST API via OSP",
      status: "ok",
      items,
      note: items.length === 0
        ? "No cultural heritage objects or protection zones found intersecting this parcel."
        : `Found ${items.length} cultural heritage records intersecting this parcel.`,
    };
  } catch (err: any) {
    return {
      key: "kvr-heritage",
      title: "Cultural Heritage Register",
      source: "KVR ArcGIS REST API via OSP",
      status: "error",
      items: [],
      note: `Error querying cultural heritage registry: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// Building Data Bank panel built from pre-fetched OSP pastatai_geo points (managed
// multi-apartment buildings). Points are fetched once upstream and reused for the
// GRPK footprint spatial join, so this no longer issues its own query.
export function buildPdbisPanel(ospPoints: OspBuildingPoint[]): UpstreamPanel {
  try {
    const items = ospPoints.map((b) => ({
      address: b.address || "N/A",
      apartmentsCount: b.apartments ?? "N/A",
      nonResidentialCount: b.nonResidential ?? "N/A",
      floorsCount: b.floors ?? "N/A",
      buildingAreaSqM: b.buildingAreaSqM ?? "N/A",
      constructionYear: b.constructionYear ?? "N/A",
      managementForm: b.managementForm,
      managerCategory: b.manager,
      condition: b.condition,
      renovationWorks: b.renovationWorks,
    }));

    return {
      key: "pdbis-building-data",
      title: "Building Data Bank",
      source: "pastatai_geo API via OSP",
      status: "ok",
      items,
      note: items.length === 0
        ? "No registered (managed) buildings found on this parcel."
        : `Found ${items.length} registered building(s) on this parcel.`,
    };
  } catch (err: any) {
    return {
      key: "pdbis-building-data",
      title: "Building Data Bank",
      source: "pastatai_geo API via OSP",
      status: "error",
      items: [],
      note: `Error building register panel: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// SŽNS — Specialiosios žemės naudojimo sąlygos (special land use conditions /
// restrictions registry, VĮ Registrų centras). The map (image) view is public, but
// the feature /query capability is NOT exposed on the public proxy (returns an Esri
// error: 401 "Užklausos naudojimas apribotas" or 400 "operation not supported"),
// so restrictions cannot be extracted as vector data anonymously. We attempt the
// query so it works automatically once an authorized RC endpoint is wired; otherwise
// we degrade to a "partial" panel documenting the authorization path.
const SZNS_PROBE_URL =
  "https://www.geoportal.lt/mapproxy/rc_szns/MapServer/0/query";

export async function fetchSznsRestrictions(geometry: any): Promise<UpstreamPanel> {
  const base: Pick<UpstreamPanel, "key" | "title" | "source"> = {
    key: "szns-restrictions",
    title: "Special Land Use Conditions (SŽNS / apribojimai)",
    source: "geoportal.lt rc_szns (VĮ Registrų centras)",
  };
  const authNote =
    "SŽNS feature/query data is not available on the public geoportal.lt service " +
    "(map-view only; feature extraction is gated by VĮ Registrų centras). " +
    "To pull restrictions/servitutai as data, request access at " +
    "https://www.registrucentras.lt/p/1553 . Protected territories and heritage " +
    "protection zones are still covered by the environmental and KVR panels above.";

  const arcgisGeom = getArcgisGeometry(geometry);
  if (!arcgisGeom) {
    return { ...base, status: "partial", items: [], note: authNote };
  }

  const params = new URLSearchParams();
  params.append("where", "1=1");
  params.append("geometry", JSON.stringify(arcgisGeom));
  params.append("geometryType", "esriGeometryPolygon");
  params.append("spatialRel", "esriSpatialRelIntersects");
  params.append("inSR", "4326");
  params.append("returnCountOnly", "true");
  params.append("f", "json");

  try {
    const response = await fetch(SZNS_PROBE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const data = await response.json().catch(() => ({}));
    if (data?.error || !response.ok) {
      return { ...base, status: "partial", items: [], note: authNote };
    }
    // If access is ever granted, surface the count as a starting signal.
    return {
      ...base,
      status: "ok",
      items: typeof data.count === "number" ? [{ intersectingConditions: data.count }] : [],
      note: "SŽNS query authorized — extend fetchSznsRestrictions to enumerate the 58 condition layers for full detail.",
    };
  } catch (err: any) {
    return { ...base, status: "partial", items: [], note: authNote };
  }
}

// ASGR — "Aktuali suvestinė informacija apie galiojančius reglamentus" (TPDR).
// Open, queryable ArcGIS MapServer published by planuojustatau.lt. Layer 0 is a
// polygon coverage of the binding territorial-planning regulations (max building
// height/intensity/density, land-use purpose & method, functional zone). This is
// the open-data route around the gated SŽNS service: it answers "what may be built
// here". No API key, live spatial intersect — same pattern as the other connectors.
const ASGR_URL =
  "https://tpdr.planuojustatau.lt/arcgis/rest/services/duomenu_viesinimas/ASGR/MapServer";

// Epoch-ms ArcGIS date → YYYY-MM-DD, or "N/A".
function arcgisDate(value: unknown): string {
  return typeof value === "number" && value > 0
    ? new Date(value).toISOString().slice(0, 10)
    : "N/A";
}

export async function fetchAsgrRegulations(geometry: any): Promise<UpstreamPanel> {
  const base: Pick<UpstreamPanel, "key" | "title" | "source"> = {
    key: "asgr-regulations",
    title: "Planning Regulations (ASGR — galiojantys reglamentai)",
    source: "planuojustatau.lt TPDR (Aktuali suvestinė galiojančių reglamentų)",
  };

  if (!getArcgisGeometry(geometry)) {
    return { ...base, status: "error", items: [], note: "Parcel geometry unavailable; cannot query planning regulations." };
  }

  try {
    const rows = await queryArcgisLayer(ASGR_URL, 0, geometry);
    const items = rows.map((a) => ({
      summary: a.APIBENDR || a.VAIZD || "N/A",
      mainPurpose: a.PAGR_PASK || "N/A",
      useMethod: a.NAUD_BUD || "N/A",
      useType: a.NAUD_TIP || "N/A",
      functionalZone: a.FUNKC_ZON || "N/A",
      maxHeightM: a.MAX_AUK_M ?? "N/A",
      maxIntensity: a.MAX_INTENS ?? "N/A",
      maxDensityPct: a.MAX_TANKIS ?? "N/A",
      minGreeneryPct: a.MIN_APZELD ?? "N/A",
      documentNo: a.PAGR_PASKNR || a.FUNKC_ZONNR || "N/A",
      approvedAt: arcgisDate(a.PAGR_PASKD ?? a.FUNKC_ZOND),
    }));

    return {
      ...base,
      status: "ok",
      items,
      note: items.length === 0
        ? "No binding planning regulations (ASGR) intersect this parcel."
        : `Found ${items.length} planning-regulation zone(s) intersecting this parcel.`,
    };
  } catch (err: any) {
    return {
      ...base,
      status: "error",
      items: [],
      note: `Error querying ASGR planning regulations: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// GRPK (Georeferencinio pagrindo kadastras) building footprints from geoportal.lt.
// This is the open, queryable source of actual building polygon geometry — used to
// draw buildings on the map. Layer 22 = "Pastatai". Server returns Esri JSON only
// (no GeoJSON) but reprojects to EPSG:4326 via outSR. Note: outFields must be "*"
// (a field subset triggers a 400 on this legacy ArcGIS 10.31 server).
const GRPK_BUILDINGS_URL =
  "https://www.geoportal.lt/arcgis/rest/services/NZT/GRPK/MapServer/22/query";

export async function fetchGrpkBuildings(
  geometry: any,
  addressPoints: BiipAddressPoint[] = [],
  ospPoints: OspBuildingPoint[] = [],
): Promise<{ panel: UpstreamPanel; footprints: BuildingFootprint[] }> {
  const arcgisGeom = getArcgisGeometry(geometry);

  const errorPanel = (note: string): { panel: UpstreamPanel; footprints: BuildingFootprint[] } => ({
    panel: {
      key: "grpk-buildings",
      title: "Building Footprints (GRPK)",
      source: "geoportal.lt GRPK (Georeferencinio pagrindo kadastras)",
      status: "error",
      items: [],
      note,
    },
    footprints: [],
  });

  if (!arcgisGeom) {
    return errorPanel("Parcel geometry unavailable; cannot query building footprints.");
  }

  const params = new URLSearchParams();
  params.append("where", "1=1");
  params.append("geometry", JSON.stringify(arcgisGeom));
  params.append("geometryType", "esriGeometryPolygon");
  params.append("spatialRel", "esriSpatialRelIntersects");
  params.append("inSR", "4326");
  params.append("outSR", "4326");
  params.append("outFields", "*");
  params.append("returnGeometry", "true");
  params.append("f", "json");

  try {
    const response = await fetch(GRPK_BUILDINGS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} from GRPK service`);
    const data = await response.json();
    if (data.error) throw new Error(data.error.message || "GRPK query error");

    const footprints: BuildingFootprint[] = [];
    const items: Record<string, any>[] = [];
    let enriched = 0;

    for (const feature of data.features || []) {
      const rings = feature.geometry?.rings;
      if (!rings || rings.length === 0) continue;
      const outerRing = rings[0];
      const attrs = feature.attributes || {};
      const areaSqM = typeof attrs.SHAPE_Area === "number" ? attrs.SHAPE_Area : undefined;
      const purposeCode = attrs.PASK ? String(attrs.PASK) : undefined;

      // Spatial join: label this footprint with the BIIP address point inside it,
      // and attach OSP registry attributes when a managed building falls within.
      const addr = addressPoints.find((a) => a.point && pointInRing(a.point, outerRing));
      const osp = ospPoints.find((o) => o.point && pointInRing(o.point, outerRing));
      if (addr || osp) enriched++;

      const footprint: BuildingFootprint = {
        geometry: { type: "Polygon", coordinates: rings },
        areaSqM,
        purposeCode,
      };
      const address = addr?.fullAddress || osp?.address;
      if (address) footprint.address = address;
      if (osp?.constructionYear != null) footprint.constructionYear = osp.constructionYear;
      if (osp?.floors != null) footprint.floors = osp.floors;
      if (osp?.apartments != null) footprint.apartments = osp.apartments;
      footprints.push(footprint);

      items.push({
        address: address || "N/A",
        purposeCode: purposeCode || "N/A",
        areaSqM: areaSqM !== undefined ? Number(areaSqM).toFixed(1) : "N/A",
        floors: osp?.floors ?? "N/A",
        apartments: osp?.apartments ?? "N/A",
        constructionYear: osp?.constructionYear ?? "N/A",
        condition: osp?.condition ?? "N/A",
        cadastralKey: attrs.GRAKTAS || "N/A",
        lastUpdated: attrs.Red_DATA ? new Date(attrs.Red_DATA).toISOString().slice(0, 10) : "N/A",
      });
    }

    return {
      panel: {
        key: "grpk-buildings",
        title: "Building Footprints (GRPK + BIIP/OSP)",
        source: "geoportal.lt GRPK, joined with BIIP addresses & OSP pastatai_geo",
        status: "ok",
        items,
        note: footprints.length === 0
          ? "No building footprints found intersecting this parcel in GRPK."
          : `Found ${footprints.length} building footprint(s) on this parcel (drawn on map); ${enriched} matched to an address/registry record.`,
      },
      footprints,
    };
  } catch (err: any) {
    return errorPanel(
      `Error querying GRPK building footprints: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
