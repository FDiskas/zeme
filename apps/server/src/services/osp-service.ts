import type { UpstreamPanel } from "./connectors";

// Strip null/NaN/undefined points from ArcGIS geometry rings so the output
// satisfies z.array(z.array(z.array(z.number()))).
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

function formatUniqueNumber(unikalusNr: string | number | undefined | null): string {
  if (!unikalusNr) return "";
  const str = String(unikalusNr).replace(/[^0-9]/g, "");
  if (str.length === 12) {
    return `${str.slice(0, 4)}-${str.slice(4, 8)}-${str.slice(8, 12)}`;
  }
  return str;
}

async function queryArcgisLayer(
  serviceUrl: string,
  layerId: number,
  params: Record<string, string>
): Promise<any[]> {
  const url = `${serviceUrl}/${layerId}/query`;
  const urlParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    urlParams.append(key, value);
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: urlParams.toString(),
    signal: AbortSignal.timeout(6000), // 6 seconds timeout
  });

  if (!response.ok) {
    throw new Error(`HTTP error ${response.status} from ArcGIS service`);
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.message || "ArcGIS query error");
  }

  return data.features || [];
}

export interface OspParcelData {
  kadastro_nr: string;
  unikalus_nr: string;
  skl_plotas: number;
  pastat_sk: number;
  adr_sk: number;
  sen_pavad: string;
  sav_pavad: string;
  st_p: number;
  st_p_pavad: string;
  kvr_p: number;
  kvr_p_pavad: string;
  ntr_duom_data: string;
  adr_duom_data: string;
  stk_duom_data: string;
  kvr_duom_data: string;
  geometry: any;
}

export interface NeighborParcel {
  cadastralRegNo: string;
  geometry: { type: "Polygon"; coordinates: number[][][] };
}

// Bounding box of every ring in a Polygon/MultiPolygon, expanded outward by
// `marginRatio` of its own size so the map shows a band of surrounding parcels,
// not just the ones literally touching the subject parcel's edge.
function expandedEnvelope(geometry: any, marginRatio = 0.75) {
  const arcgisGeom = getArcgisGeometry(geometry);
  if (!arcgisGeom) return null;

  let xmin = Infinity, ymin = Infinity, xmax = -Infinity, ymax = -Infinity;
  for (const ring of arcgisGeom.rings) {
    for (const [x, y] of ring as [number, number][]) {
      if (x < xmin) xmin = x;
      if (y < ymin) ymin = y;
      if (x > xmax) xmax = x;
      if (y > ymax) ymax = y;
    }
  }
  if (!Number.isFinite(xmin) || !Number.isFinite(ymin)) return null;

  const dx = (xmax - xmin) * marginRatio || 0.001;
  const dy = (ymax - ymin) * marginRatio || 0.001;
  return {
    xmin: xmin - dx,
    ymin: ymin - dy,
    xmax: xmax + dx,
    ymax: ymax + dy,
    spatialReference: { wkid: 4326 },
  };
}

// Parcels around the subject parcel, for the grey clickable context layer on the
// map. Spatial query against ntr_sklypai over an expanded bounding box; the
// subject parcel itself is filtered out by cadastral number.
export async function fetchNeighborParcels(
  geometry: any,
  excludeCadastralRegNo: string,
  limit = 80,
): Promise<NeighborParcel[]> {
  const envelope = expandedEnvelope(geometry);
  if (!envelope) return [];

  const serviceUrl = "https://osp-sdg.stat.gov.lt/arcgis/rest/services/ntr_sklypai/FeatureServer";
  try {
    const features = await queryArcgisLayer(serviceUrl, 0, {
      geometry: JSON.stringify(envelope),
      geometryType: "esriGeometryEnvelope",
      spatialRel: "esriSpatialRelIntersects",
      inSR: "4326",
      outSR: "4326",
      outFields: "kadastro_nr",
      returnGeometry: "true",
      f: "json",
    });

    const neighbors: NeighborParcel[] = [];
    for (const f of features) {
      const cadastralRegNo = f.attributes?.kadastro_nr;
      const rawRings = f.geometry?.rings;
      if (!cadastralRegNo || cadastralRegNo === excludeCadastralRegNo) continue;
      if (!Array.isArray(rawRings)) continue;
      const rings = sanitizeRings(rawRings);
      if ((rings[0]?.length ?? 0) < 4) continue;
      neighbors.push({ cadastralRegNo, geometry: { type: "Polygon", coordinates: rings } });
      if (neighbors.length >= limit) break;
    }
    return neighbors;
  } catch (err) {
    console.error("Error querying OSP neighbor parcels:", err);
    return [];
  }
}

// All parcel outlines intersecting an explicit WGS84 bounding box — used to
// populate the map's clickable polygon layer when the user is zoomed in enough.
export async function fetchParcelsByBbox(
  minLat: number,
  minLng: number,
  maxLat: number,
  maxLng: number,
  limit = 150,
): Promise<NeighborParcel[]> {
  const envelope = {
    xmin: minLng,
    ymin: minLat,
    xmax: maxLng,
    ymax: maxLat,
    spatialReference: { wkid: 4326 },
  };
  const serviceUrl = "https://osp-sdg.stat.gov.lt/arcgis/rest/services/ntr_sklypai/FeatureServer";
  try {
    const features = await queryArcgisLayer(serviceUrl, 0, {
      geometry: JSON.stringify(envelope),
      geometryType: "esriGeometryEnvelope",
      spatialRel: "esriSpatialRelIntersects",
      inSR: "4326",
      outSR: "4326",
      outFields: "kadastro_nr",
      returnGeometry: "true",
      f: "json",
    });
    const parcels: NeighborParcel[] = [];
    for (const f of features) {
      const cadastralRegNo = f.attributes?.kadastro_nr;
      const rawRings = f.geometry?.rings;
      if (!cadastralRegNo) continue;
      if (!Array.isArray(rawRings)) continue;
      const rings = sanitizeRings(rawRings);
      if ((rings[0]?.length ?? 0) < 4) continue;
      parcels.push({ cadastralRegNo, geometry: { type: "Polygon", coordinates: rings } });
      if (parcels.length >= limit) break;
    }
    return parcels;
  } catch (err) {
    console.error("Error querying OSP parcels by bbox:", err);
    return [];
  }
}

// Reverse lookup against ntr_sklypai: the cadastral number of the parcel a
// WGS84 point falls inside, or null. Used as a fallback when BIIP can't resolve
// a clicked map coordinate.
export async function fetchParcelByPoint(lat: number, lng: number): Promise<string | null> {
  const serviceUrl = "https://osp-sdg.stat.gov.lt/arcgis/rest/services/ntr_sklypai/FeatureServer";
  const point = { x: lng, y: lat, spatialReference: { wkid: 4326 } };
  try {
    const features = await queryArcgisLayer(serviceUrl, 0, {
      geometry: JSON.stringify(point),
      geometryType: "esriGeometryPoint",
      spatialRel: "esriSpatialRelIntersects",
      inSR: "4326",
      outFields: "kadastro_nr",
      returnGeometry: "false",
      f: "json",
    });
    return features[0]?.attributes?.kadastro_nr ?? null;
  } catch (err) {
    console.error("Error resolving parcel by point (OSP):", err);
    return null;
  }
}

export async function fetchOspParcelData(queryStr: string): Promise<OspParcelData | null> {
  const serviceUrl = "https://osp-sdg.stat.gov.lt/arcgis/rest/services/ntr_sklypai/FeatureServer";
  const cleanQuery = queryStr.trim();
  
  // Build query to match either cadastral number or unique number
  const where = `kadastro_nr = '${cleanQuery}' OR unikalus_nr = '${cleanQuery}'`;

  try {
    const features = await queryArcgisLayer(serviceUrl, 0, {
      where,
      outFields: "*",
      returnGeometry: "true",
      outSR: "4326",
      f: "json"
    });

    if (features.length === 0) return null;

    const raw = features[0]!;
    const attrs = raw.attributes || {};
    
    // Parse geometry (rings -> GeoJSON Polygon)
    let geometry: any = null;
    if (raw.geometry?.rings) {
      geometry = {
        type: "Polygon" as const,
        coordinates: raw.geometry.rings
      };
    }

    return {
      kadastro_nr: attrs.kadastro_nr || cleanQuery,
      unikalus_nr: attrs.unikalus_nr || "",
      skl_plotas: attrs.skl_plotas || 0,
      pastat_sk: attrs.pastat_sk || 0,
      adr_sk: attrs.adr_sk || 0,
      sen_pavad: attrs.sen_pavad || "",
      sav_pavad: attrs.sav_pavad || "",
      st_p: attrs.st_p || 0,
      st_p_pavad: attrs.st_p_pavad || "",
      kvr_p: attrs.kvr_p || 0,
      kvr_p_pavad: attrs.kvr_p_pavad || "",
      ntr_duom_data: attrs.ntr_duom_data || "N/A",
      adr_duom_data: attrs.adr_duom_data || "N/A",
      stk_duom_data: attrs.stk_duom_data || "N/A",
      kvr_duom_data: attrs.kvr_duom_data || "N/A",
      geometry
    };
  } catch (err) {
    console.error("Error querying OSP parcel service:", err);
    return null;
  }
}

export async function fetchOspBuildingPermits(
  cadastralRegNo: string,
  unikalusNr?: string
): Promise<any[]> {
  const serviceUrl = "https://osp-sdg.stat.gov.lt/arcgis/rest/services/infostatyba_duomenys/FeatureServer";
  
  let where = `kadastro_nr = '${cadastralRegNo}'`;
  if (unikalusNr) {
    const formatted = formatUniqueNumber(unikalusNr);
    if (formatted) {
      where = `kadastro_nr = '${cadastralRegNo}' OR unikalus_numeris = '${formatted}' OR unikalus_numeris = '${unikalusNr}'`;
    }
  }

  try {
    const features = await queryArcgisLayer(serviceUrl, 0, {
      where,
      outFields: "*",
      returnGeometry: "false",
      f: "json"
    });

    return features.map((f: any) => {
      const attrs = f.attributes || {};
      const regDate = attrs.dokumento_reg_data ? new Date(attrs.dokumento_reg_data).toISOString().split("T")[0] : "N/A";
      const recordDate = attrs.iraso_data ? new Date(attrs.iraso_data).toISOString().split("T")[0] : "N/A";
      
      return {
        permitNumber: attrs.dokumento_reg_nr || "N/A",
        permitType: attrs.dokumento_kategorija || "N/A",
        issuedDate: regDate,
        status: attrs.dok_statusas || attrs.dok_irasas || "N/A",
        buildingDescription: attrs.statinio_pavadinimas || attrs.projekto_pavadinimas || "N/A",
        buildingPurpose: attrs.statinio_paskirtis || "N/A",
        buildingCategory: attrs.statinio_kategorija || "N/A",
        constructionType: attrs.statybos_rusis || "N/A",
        address: attrs.adresas || "N/A",
        projectYear: attrs.projekto_metai || "N/A",
        uniqueBuildingNo: attrs.unikalus_numeris || "N/A",
        recordDate: recordDate
      };
    });
  } catch (err) {
    console.error("Error querying OSP Infostatyba service:", err);
    return [];
  }
}

export interface OspBuildingPoint {
  point: [number, number] | null;
  address: string;
  apartments: number | null;
  nonResidential: number | null;
  floors: number | null;
  buildingAreaSqM: number | null;
  constructionYear: number | null;
  managementForm: string;
  manager: string;
  condition: string;
  renovationWorks: string;
}

// OSP "pastatai_geo" — managed multi-apartment buildings (point geometry, ~4k nationwide).
// Sparse, so most parcels return none; used to enrich GRPK footprints where present.
export async function fetchOspBuildingPoints(geometry: any): Promise<OspBuildingPoint[]> {
  const serviceUrl = "https://osp-sdg.stat.gov.lt/arcgis/rest/services/pastatai_geo/FeatureServer";
  const arcgisGeom = getArcgisGeometry(geometry);
  if (!arcgisGeom) return [];

  try {
    const features = await queryArcgisLayer(serviceUrl, 0, {
      geometry: JSON.stringify(arcgisGeom),
      geometryType: "esriGeometryPolygon",
      spatialRel: "esriSpatialRelIntersects",
      inSR: "4326",
      outSR: "4326",
      outFields: "*",
      returnGeometry: "true",
      f: "json",
    });

    return features.map((f: any) => {
      const a = f.attributes || {};
      const g = f.geometry;
      const year =
        typeof a.statybos_metai === "number" ? new Date(a.statybos_metai).getUTCFullYear() : null;
      return {
        point: g && typeof g.x === "number" ? [g.x, g.y] : null,
        address: `${a.gatve || ""} ${a.namo_nr || ""}`.trim(),
        apartments: a.butu_sk ?? null,
        nonResidential: a.negyvenamu_sk ?? null,
        floors: a.aukstu_sk ?? null,
        buildingAreaSqM: a.namo_plotas ?? null,
        constructionYear: year,
        managementForm: a.valdymo_forma || "N/A",
        manager: a.valdytojas || "N/A",
        condition: a.bukle || "N/A",
        renovationWorks: a.atlikti_darbai || "N/A",
      };
    });
  } catch (err) {
    console.error("Error querying OSP building points service:", err);
    return [];
  }
}

export async function fetchOspPollutionSites(geometry: any): Promise<any[]> {
  const serviceUrl = "https://osp-sdg.stat.gov.lt/arcgis/rest/services/potencialus_tarsos_zidiniai/FeatureServer";
  // Use an envelope (bounding-box) instead of the full polygon — the OSP ArcGIS
  // service rejects complex polygon queries for some parcels with "Unable to
  // complete operation". An envelope intersect is a reasonable approximation for
  // point-geometry pollution data and is far more robust.
  const envelope = expandedEnvelope(geometry, 0);
  if (!envelope) return [];

  try {
    const features = await queryArcgisLayer(serviceUrl, 0, {
      geometry: JSON.stringify(envelope),
      geometryType: "esriGeometryEnvelope",
      spatialRel: "esriSpatialRelIntersects",
      inSR: "4326",
      outSR: "4326",
      outFields: "*",
      returnGeometry: "false",
      f: "json"
    });

    return features.map((f: any) => {
      const attrs = f.attributes || {};
      const evalDate = attrs.ptz_anketos_data ? new Date(attrs.ptz_anketos_data).toISOString().split("T")[0] : "N/A";

      return {
        siteNumber: attrs.objecto_nr || "N/A",
        address: attrs.ptz_adresas || "N/A",
        recordNumber: attrs.ptz_anketos_nr || "N/A",
        evaluationDate: evalDate,
        status: attrs.ptz_objekto_bukle || "N/A",
        siteType: attrs.ptz_objekto_tipas || "N/A",
        hazardLevel: attrs.ptz_pavojingumas_aplinkai || "N/A"
      };
    });
  } catch (err) {
    console.error("Error querying OSP pollution sources service:", err);
    return [];
  }
}

// Connector methods that format data directly into UpstreamPanel objects for the UI reportPanels
export async function getOspParcelSummaryPanel(cadastralRegNo: string): Promise<UpstreamPanel> {
  const data = await fetchOspParcelData(cadastralRegNo);
  
  if (!data) {
    return {
      key: "osp-parcel-summary",
      title: "OSP žemės sklypų registras",
      source: "OSP ntr_sklypai FeatureServer",
      status: "error",
      items: [],
      note: `Nerasta oficialaus sklypo įrašo OSP registre (kadastro Nr.: ${cadastralRegNo})`,
    };
  }

  const items = [
    {
      cadastralNumber: data.kadastro_nr,
      uniqueNumber: data.unikalus_nr,
      registeredAreaHa: data.skl_plotas,
      buildingsCount: data.pastat_sk,
      addressesCount: data.adr_sk,
      eldership: data.sen_pavad || "N/A",
      municipality: data.sav_pavad || "N/A",
      protectedAreaOverlapPercentage: `${data.st_p}%`,
      protectedAreaNames: data.st_p_pavad || "Nėra",
      culturalHeritageOverlapPercentage: `${data.kvr_p}%`,
      culturalHeritageNames: data.kvr_p_pavad || "Nėra",
      cadastralDataDate: data.ntr_duom_data,
      addressDataDate: data.adr_duom_data,
      protectedAreaKadastroDate: data.stk_duom_data,
      culturalHeritageKadastroDate: data.kvr_duom_data
    }
  ];

  return {
    key: "osp-parcel-summary",
    title: "OSP žemės sklypų registras",
    source: "OSP ntr_sklypai FeatureServer",
    status: "ok",
    items,
    note: `Gauti oficialaus kadastro ribos ir registro duomenys iš OSP.`
  };
}

export async function getOspPollutionRisksPanel(geometry?: any): Promise<UpstreamPanel> {
  if (!geometry) {
    return {
      key: "osp-pollution-risks",
      title: "Aplinkosauga: taršos rizikos objektai",
      source: "OSP potencialus_tarsos_zidiniai FeatureServer",
      status: "partial",
      items: [],
      note: "Sklypo ribos geometrija būtina taršos rizikos tikrinimui."
    };
  }

  try {
    const sites = await fetchOspPollutionSites(geometry);

    return {
      key: "osp-pollution-risks",
      title: "Aplinkosauga: taršos rizikos objektai",
      source: "OSP potencialus_tarsos_zidiniai FeatureServer",
      status: "ok",
      items: sites,
      note: sites.length === 0
        ? "Sklype nerasta potencialių taršos žldinių ar aplinkosauginių rizikos objektų."
        : `Rasta ${sites.length} potencialių taršos / aplinkosauginių rizikos objektų.`
    };
  } catch (err: any) {
    return {
      key: "osp-pollution-risks",
      title: "Aplinkosauga: taršos rizikos objektai",
      source: "OSP potencialus_tarsos_zidiniai FeatureServer",
      status: "error",
      items: [],
      note: `Klaida tikrinant taršos rizikos geoduomenis: ${err instanceof Error ? err.message : String(err)}`
    };
  }
}
