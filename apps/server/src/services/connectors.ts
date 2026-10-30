import type { ParcelReport, BuildingFootprint } from "@zeme/shared";
import type { BiipAddressPoint } from "./biip-service";
import type { OspBuildingPoint } from "./osp-service";
import { findForestCuttingPermits } from "./lkmp-service";
import { describeUpstreamError } from "./upstream-error";

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

// The parcel's polygons as lists of rings (outer first, then holes).
function polygonsOf(geometry: any): number[][][][] {
  if (geometry?.type === "Polygon") return [geometry.coordinates];
  if (geometry?.type === "MultiPolygon") return geometry.coordinates;
  return [];
}

function pointInPolygons(point: [number, number], polygons: number[][][][]): boolean {
  return polygons.some(
    ([outer, ...holes]) => outer !== undefined && pointInRing(point, outer) && !holes.some((h) => pointInRing(point, h)),
  );
}

function ringCentre(ring: number[][]): [number, number] {
  const sum = ring.reduce(([x, y], [px, py]) => [x + px!, y + py!], [0, 0]);
  return [sum[0]! / ring.length, sum[1]! / ring.length];
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
      title: "Sklypo ribos ir naudojimo paskirtis",
      source: "biip.lt",
      status: "ok",
      items: [
        {
          cadastralRegNo: parcel.cadastralRegNo,
          uniqueNumber: parcel.uniqueNumber,
          municipality: parcel.municipalityName,
          municipalityCode: parcel.uniqueNumber ? String(parcel.uniqueNumber).slice(0, 2) : "41",
          areaHectares: parcel.areaHa,
          // BIIP's purpose group is always "Žemės naudojimo" (the name of the
          // group, not a value), so only the purpose itself is passed on.
          landUse: parcel.purposeFullName || parcel.purposeName || "Kita (žemės)",
          status: parcel.status || "N/A",
          updatedAt: parcel.updatedAt || "N/A",
        },
      ],
    };
  }

  return {
    key: "biip-boundary",
    title: "Sklypo ribos ir naudojimo paskirtis",
    source: "biip.lt",
    status: "error",
    items: [],
    note: `Nepavyko nustatyti sklypo ribų iš BIIP registro (kadastro Nr.: ${cadastralRegNo})`,
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
      title: "Adresų taškai ir patalpos (BIIP)",
      source: "biip.lt",
      status: "error",
      items: [],
      note: `Nepavyko gauti sklypo geometrijos iš BIIP (kadastro Nr.: ${cadastralRegNo})`,
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
    type: "Adreso taškas",
    address: a.fullAddress,
    plotOrBuildingNumber: a.plotOrBuildingNumber,
    postalCode: a.postalCode || "N/A",
    coordinates: a.point ? `${a.point[1].toFixed(6)}, ${a.point[0].toFixed(6)}` : "N/A",
  }));

  const roomItems = rooms.map((r) => ({
    type: "Patalpa",
    roomNumber: r.roomNumber,
    address: r.fullAddress,
  }));

  const items = [...addressItems, ...roomItems];

  return {
    key: "biip-addresses",
    title: "Adresų taškai ir patalpos (BIIP)",
    source: "biip.lt",
    status: "ok",
    items,
    note: items.length === 0
      ? "Sklype neregistruota adresų taškų ar patalpų."
      : `Rasta ${addressItems.length} adresų taškų ir ${roomItems.length} patalpų.`,
  };
}

export function geometryToEwkt(geometry: any): string | undefined {
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
      title: "Aplinkosauginiai apribojimai (saugomos teritorijos)",
      source: "Valstybinis saugomų teritorijų kadastras (VSTT STVK) per OSP",
      status: "error",
      items: [],
      note: `Nepavyko nustatyti sklypo koordinačių (kadastro Nr.: ${cadastralRegNo})`,
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
        type: "Draustinis",
        name: attrs.pavadinimas,
        code: attrs.id || attrs.gkodas || "N/A",
      })),
      ...parkai.map(attrs => ({
        type: "Nacionalinis / regioninis parkas",
        name: attrs.pavadinimas,
        code: attrs.id || attrs.gkodas || "N/A",
      })),
      ...rezervatai.map(attrs => ({
        type: "Rezervatas",
        name: attrs.pavadinimas,
        code: attrs.id || attrs.gkodas || "N/A",
      })),
      ...buveines.map(attrs => ({
        type: "Buveinių apsaugai svarbi teritorija",
        name: attrs.pavadinimas,
        code: attrs.id || attrs.gkodas || "N/A",
      })),
      ...pauksciai.map(attrs => ({
        type: "Paukščių apsaugai svarbi teritorija",
        name: attrs.pavadinimas,
        code: attrs.id || attrs.gkodas || "N/A",
      })),
    ];

    return {
      key: "geoportal-constraints",
      title: "Aplinkosauginiai apribojimai (saugomos teritorijos)",
      source: "Valstybinis saugomų teritorijų kadastras (VSTT STVK) per OSP",
      status: "ok",
      items,
      note: items.length === 0
        ? "Sklypas nesikerta su saugomomis teritorijomis ar aplinkosauginiais apribojimais."
        : `Rasta ${items.length} aplinkosauginių apribojimų / saugomų teritorijų.`,
    };
  } catch (err: any) {
    return {
      key: "geoportal-constraints",
      title: "Aplinkosauginiai apribojimai (saugomos teritorijos)",
      source: "Valstybinis saugomų teritorijų kadastras (VSTT STVK) per OSP",
      status: "error",
      items: [],
      note: `Klaida tikrinant aplinkosauginius apribojimus: ${describeUpstreamError(err)}`,
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
      title: "Kultūros paveldo registras (KVR)",
      source: "KVR ArcGIS REST API per OSP",
      status: "error",
      items: [],
      note: `Nepavyko nustatyti sklypo koordinačių (kadastro Nr.: ${cadastralRegNo})`,
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
        type: "Kultūros paveldo objektas (poligonas)",
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
        type: "Kultūros paveldo objektas (taškas)",
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
        type: "Apsaugos zona",
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
      title: "Kultūros paveldo registras (KVR)",
      source: "KVR ArcGIS REST API per OSP",
      status: "ok",
      items,
      note: items.length === 0
        ? "Sklypas nesikerta su kultūros paveldo objektais ar apsaugos zonomis."
        : `Rasta ${items.length} kultūros paveldo įrašų.`,
    };
  } catch (err: any) {
    return {
      key: "kvr-heritage",
      title: "Kultūros paveldo registras (KVR)",
      source: "KVR ArcGIS REST API per OSP",
      status: "error",
      items: [],
      note: `Klaida tikrinant kultūros paveldo registrą: ${describeUpstreamError(err)}`,
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
      title: "Pastatų duomenų bankas (PDBIS)",
      source: "pastatai_geo API per OSP",
      status: "ok",
      items,
      note: items.length === 0
        ? "Sklype nerasta valdomų daugiabučių."
        : `Rasta ${items.length} valdomų pastatų.`,
    };
  } catch (err: any) {
    return {
      key: "pdbis-building-data",
      title: "Pastatų duomenų bankas (PDBIS)",
      source: "pastatai_geo API per OSP",
      status: "error",
      items: [],
      note: `Klaida generuojant pastatų registro duomenis: ${describeUpstreamError(err)}`,
    };
  }
}

// SŽNS — Specialiosios žemės naudojimo sąlygos (special land use conditions
// registry, VĮ Registrų centras). The public proxy answers /identify without a
// key, with the whole parcel outline as the shape, but only with returnGeometry
// =false: geometry (401), /query (400) and /export (500) are kept to RC's
// contract customers. So we can say WHICH conditions apply, not how much of the
// parcel they cover. Each layer is one condition type, its SŽNS code in the
// name ("Elektros AZ (106)"); one parcel often lies in several zones of a type.
const SZNS_IDENTIFY_URL =
  "https://www.geoportal.lt/mapproxy/rc_szns/MapServer/identify";

// "Valstybiniai parkai (V skyrius, dvidešimt trečiasis skirsnis)" → the name
// and the part of the SŽNS law that sets the conditions.
function splitSznsName(name: string): { name: string; lawSection?: string } {
  const match = /^(.*?)\s*\(([^()]*skyrius[^()]*)\)\s*$/.exec(name);
  return match ? { name: match[1]!, lawSection: match[2]! } : { name };
}

export async function fetchSznsRestrictions(geometry: any): Promise<UpstreamPanel> {
  const base: Pick<UpstreamPanel, "key" | "title" | "source"> = {
    key: "szns-restrictions",
    title: "Specialiosios žemės naudojimo sąlygos (SŽNS)",
    source: "geoportal.lt rc_szns (VĮ Registrų centras)",
  };

  const arcgisGeom = getArcgisGeometry(geometry);
  if (!arcgisGeom) {
    return { ...base, status: "error", items: [], note: "Sklypo geometrija nepasiekiama; specialiųjų sąlygų patikrinti negalima." };
  }

  // identify wants the map the shape was drawn on; with layers=all the layers'
  // scale ranges do not apply, so the parcel's own bbox will do.
  const points: number[][] = arcgisGeom.rings.flat();
  const lngs = points.map((p) => p[0]!);
  const lats = points.map((p) => p[1]!);
  const mapExtent = [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)].join(",");

  const identify = async () => {
    const response = await fetch(SZNS_IDENTIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        geometry: JSON.stringify(arcgisGeom),
        geometryType: "esriGeometryPolygon",
        sr: "4326",
        layers: "all",
        tolerance: "0",
        mapExtent,
        imageDisplay: "1000,1000,96",
        returnGeometry: "false",
        f: "json",
      }).toString(),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`HTTP error ${response.status} from ArcGIS service`);
    return response.json();
  };

  try {
    // The service now and then answers "Error performing identify" to a
    // request that succeeds when sent again.
    let data = await identify();
    if (data.error) data = await identify();
    if (data.error) throw new Error(data.error.message || "ArcGIS identify error");

    type Condition = { code: string; name: string; lawSection?: string; documentUrl?: string; zoneNumbers: string[] };
    const byCode = new Map<string, Condition>();
    for (const result of data.results || []) {
      const a = result.attributes || {};
      const code = /\((\d+)\s*\)\s*$/.exec(result.layerName ?? "")?.[1] ?? String(result.layerName);
      const entry: Condition = byCode.get(code) ?? {
        code,
        ...splitSznsName(a.PAVADINIM || result.layerName),
        documentUrl: a.NUORODA || undefined,
        zoneNumbers: [],
      };
      if (a.UNIK_NR && !entry.zoneNumbers.includes(a.UNIK_NR)) entry.zoneNumbers.push(a.UNIK_NR);
      byCode.set(code, entry);
    }

    const items = [...byCode.values()]
      .sort((x, y) => Number(x.code) - Number(y.code))
      .map(({ zoneNumbers, ...entry }) => ({
        ...entry,
        zonesCount: zoneNumbers.length,
        zoneNumbers: zoneNumbers.join(", "),
      }));

    return {
      ...base,
      status: "ok",
      items,
      note: items.length === 0
        ? "Sklypas nesikerta su registruotomis SŽNS teritorijomis."
        : `Sklypui taikomos ${items.length} rūšių specialiosios žemės naudojimo sąlygos.`,
    };
  } catch (err: any) {
    return {
      ...base,
      status: "error",
      items: [],
      note: `Klaida tikrinant SŽNS registrą: ${describeUpstreamError(err)}`,
    };
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
    title: "Teritorijų planavimo reglamentai (ASGR)",
    source: "planuojustatau.lt TPDR (Aktuali suvestinė galiojančių reglamentų)",
  };

  if (!getArcgisGeometry(geometry)) {
    return { ...base, status: "error", items: [], note: "Sklypo geometrija nepasiekiama; negalima tikrinti planavimo reglamentų." };
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
        ? "Sklypas nesikerta su galiojančiais planavimo reglamentais (ASGR)."
        : `Rasta ${items.length} planavimo reglamentų zonų.`,
    };
  } catch (err: any) {
    return {
      ...base,
      status: "error",
      items: [],
      note: `Klaida tikrinant ASGR planavimo reglamentus: ${describeUpstreamError(err)}`,
    };
  }
}

// SSVA (Statybos sektoriaus vystymo agentūra) per-parcel built-up ratios, open
// data (keyless; the item states no licence): ADP_SP = % of the parcel under building footprints and roofed
// structures (užstatymo tankis), PBP_SP = buildings' gross floor area ÷ parcel
// area (užstatymo intensyvumas). Gross floor area comes from the real-property
// register, which we can't read ourselves. The layer has no cadastral number, so
// the subject parcel is the feature whose centroid lies inside our outline;
// neighbours that merely touch the boundary have their centroid outside.
const SSVA_PARCEL_RATIOS_LAYER =
  "https://services-eu1.arcgis.com/IylpCF7DjNdsT4Zm/arcgis/rest/services/Pastat%C5%B3_bendrojo_ploto_ir_sklypo_santykis/FeatureServer/0";

export async function fetchBuiltUpRatios(geometry: any): Promise<UpstreamPanel> {
  const base: Pick<UpstreamPanel, "key" | "title" | "source"> = {
    key: "ssva-built-up",
    title: "Esamas užstatymas",
    source: "SSVA atviri duomenys: pastatų bendrojo ploto ir sklypo santykis",
  };

  const arcgisGeom = getArcgisGeometry(geometry);
  if (!arcgisGeom) {
    return { ...base, status: "error", items: [], note: "Sklypo geometrija nepasiekiama; užstatymo patikrinti negalima." };
  }

  try {
    const response = await fetch(`${SSVA_PARCEL_RATIOS_LAYER}/query`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        geometry: JSON.stringify(arcgisGeom),
        geometryType: "esriGeometryPolygon",
        spatialRel: "esriSpatialRelIntersects",
        inSR: "4326",
        outSR: "4326",
        outFields: "PBP_SP,ADP_SP",
        returnGeometry: "false",
        returnCentroid: "true",
        f: "json",
      }).toString(),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`HTTP error ${response.status} from ArcGIS service`);
    const data = await response.json();
    if (data.error) throw new Error(data.error.message || "ArcGIS query error");

    const subject = (data.features || []).find((f: any) => {
      const c = f.centroid;
      return c && arcgisGeom.rings.some((ring: number[][]) => pointInRing([c.x, c.y], ring));
    });
    const a = subject?.attributes;
    const items =
      a && (typeof a.ADP_SP === "number" || typeof a.PBP_SP === "number")
        ? [{
            densityPct: typeof a.ADP_SP === "number" ? Math.round(a.ADP_SP * 10) / 10 : "N/A",
            intensity: typeof a.PBP_SP === "number" ? Math.round(a.PBP_SP * 100) / 100 : "N/A",
          }]
        : [];

    return {
      ...base,
      status: "ok",
      items,
      note: items.length === 0
        ? "Šiam sklypui užstatymo rodiklių nėra (sklypas neužstatytas arba neįtrauktas į rinkinį)."
        : "Rodikliai orientaciniai: apskaičiuoti iš registruotų pastatų ir jų kontūrų.",
    };
  } catch (err: any) {
    return {
      ...base,
      status: "error",
      items: [],
      note: `Klaida tikrinant užstatymo rodiklius: ${describeUpstreamError(err)}`,
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

// Some ArcGIS services include null/undefined values in geometry rings (e.g.
// GRPK, OSP ntr_sklypai). Strip those points so the rings satisfy the schema's
// z.array(z.array(z.array(z.number()))) constraint.
function sanitizeRings(rings: any[][]): number[][][] {
  return rings.map((ring) =>
    ring.filter(
      (pt) =>
        Array.isArray(pt) &&
        pt.length >= 2 &&
        typeof pt[0] === "number" &&
        typeof pt[1] === "number" &&
        Number.isFinite(pt[0]) &&
        Number.isFinite(pt[1]),
    ),
  );
}

export async function fetchGrpkBuildings(
  geometry: any,
  addressPoints: BiipAddressPoint[] = [],
  ospPoints: OspBuildingPoint[] = [],
): Promise<{ panel: UpstreamPanel; footprints: BuildingFootprint[] }> {
  const arcgisGeom = getArcgisGeometry(geometry);

  const errorPanel = (note: string): { panel: UpstreamPanel; footprints: BuildingFootprint[] } => ({
    panel: {
      key: "grpk-buildings",
      title: "Pastatų kontūrai (GRPK)",
      source: "geoportal.lt GRPK (Georeferencinio pagrindo kadastras)",
      status: "error",
      items: [],
      note,
    },
    footprints: [],
  });

  if (!arcgisGeom) {
    return errorPanel("Sklypo geometrija nepasiekiama; negalima tikrinti pastatų kontūrų.");
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
    const parcelPolygons = polygonsOf(geometry);
    let enriched = 0;

    for (const feature of data.features || []) {
      const rawRings = feature.geometry?.rings;
      if (!rawRings || rawRings.length === 0) continue;
      const rings = sanitizeRings(rawRings);
      if ((rings[0]?.length ?? 0) < 4) continue;
      const outerRing = rings[0]!;
      // The query returns every building that touches the parcel; a
      // neighbour's building across the boundary line is not this parcel's.
      if (!pointInPolygons(ringCentre(outerRing), parcelPolygons)) continue;
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
        uniqueBuildingNo: osp?.uniqueNumber ?? "N/A",
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
        title: "Pastatų kontūrai (GRPK + BIIP/OSP)",
        source: "geoportal.lt GRPK, papildyta BIIP adresais ir OSP pastatai_geo",
        status: "ok",
        items,
        note: footprints.length === 0
          ? "GRPK nerado pastatų kontūrų šiame sklype."
          : `Rasta ${footprints.length} pastatų kontūrų sklype; ${enriched} sutapo su adreso / registro įrašu.`,
      },
      footprints,
    };
  } catch (err: any) {
    return errorPanel(
      `Klaida tikrinant GRPK pastatų kontūrus: ${describeUpstreamError(err)}`,
    );
  }
}

// Miško kirtimo leidimai (forest-cutting permits) — lkmp-service.ts. The
// data.gov.lt "Leidimų kirsti mišką statistika" dataset (tried first) only
// covers permits that already carry a cadastral number, which misses most
// state-forest cuttings: those are addressed by kvartalas/sklypas with no
// cadastral number at all, and only show up via a real polygon intersection
// against lkmp.alisas.lt's daily geometry dump (verified live: a confirmed
// "Atrankinis sanitarinis kirtimas" permit on a real parcel had
// kadastrinis_nr: null and only matched by intersecting its "biržė" polygon).
const LEID_BUSENA_LABELS: Record<string, string> = {
  ISSUED: "Išduotas",
  EXTENDED: "Pratęstas",
};

export async function fetchForestCuttingPermits(
  cadastralRegNo: string,
  geometry: any,
): Promise<UpstreamPanel> {
  const base: Pick<UpstreamPanel, "key" | "title" | "source"> = {
    key: "forest-cutting-permits",
    title: "Miško kirtimo leidimai",
    source: "lkmp.alisas.lt (VMT/ALIS, atviri geometriniai duomenys)",
  };

  const outerRing = geometry?.type === "Polygon" ? geometry.coordinates?.[0] : undefined;
  if (!outerRing || outerRing.length < 4) {
    return {
      ...base,
      status: "error",
      items: [],
      note: "Sklypo geometrija nepasiekiama; negalima tikrinti miško kirtimo leidimų.",
    };
  }

  try {
    const matches = await findForestCuttingPermits(cadastralRegNo, outerRing);

    const items = matches.map((p) => ({
      cuttingType: p.kirtimo_rusis ?? "N/A",
      validFrom: p.galioja_nuo ?? "N/A",
      validTo: p.galioja_iki ?? "N/A",
      areaHa: p.kertamas_plotas ?? "N/A",
      dominantSpecies: p.vyraujantys_medziai ?? "N/A",
      forestDistrict: p.girininkija ? `${p.girininkija} girininkija, ${p.padalinys ?? "N/A"}` : "N/A",
      ownershipForm: p.nuosavybes_forma ?? "N/A",
      status: p.leid_busena ? (LEID_BUSENA_LABELS[p.leid_busena] ?? p.leid_busena) : "N/A",
    }));

    return {
      ...base,
      status: "ok",
      items,
      note: items.length === 0
        ? "Šiam sklypui miško kirtimo leidimų nerasta."
        : `Rasta ${items.length} miško kirtimo leidimo įrašų.`,
    };
  } catch (err: any) {
    return {
      ...base,
      status: "error",
      items: [],
      note: `Klaida tikrinant miško kirtimo leidimus: ${describeUpstreamError(err)}`,
    };
  }
}
