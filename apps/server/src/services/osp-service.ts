import type { UpstreamPanel } from "./connectors";

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
      title: "State Data Agency (OSP) Parcel Registry",
      source: "OSP ntr_sklypai FeatureServer",
      status: "error",
      items: [],
      note: `Failed to find official land parcel record in State Data Agency (OSP) for: ${cadastralRegNo}`,
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
      protectedAreaNames: data.st_p_pavad || "None",
      culturalHeritageOverlapPercentage: `${data.kvr_p}%`,
      culturalHeritageNames: data.kvr_p_pavad || "None",
      cadastralDataDate: data.ntr_duom_data,
      addressDataDate: data.adr_duom_data,
      protectedAreaKadastroDate: data.stk_duom_data,
      culturalHeritageKadastroDate: data.kvr_duom_data
    }
  ];

  return {
    key: "osp-parcel-summary",
    title: "State Data Agency (OSP) Parcel Registry",
    source: "OSP ntr_sklypai FeatureServer",
    status: "ok",
    items,
    note: `Retrieved official cadastral boundary and registry details from State Data Agency (OSP).`
  };
}

export async function getOspPollutionRisksPanel(geometry?: any): Promise<UpstreamPanel> {
  if (!geometry) {
    return {
      key: "osp-pollution-risks",
      title: "Environmental & Pollution Risks",
      source: "OSP potencialus_tarsos_zidiniai FeatureServer",
      status: "partial",
      items: [],
      note: "Parcel boundary geometry is required to query pollution risks spatially."
    };
  }

  try {
    const sites = await fetchOspPollutionSites(geometry);

    return {
      key: "osp-pollution-risks",
      title: "Environmental & Pollution Risks",
      source: "OSP potencialus_tarsos_zidiniai FeatureServer",
      status: "ok",
      items: sites,
      note: sites.length === 0
        ? "No potential environmental contamination sources or pollution sites found intersecting this parcel."
        : `Found ${sites.length} potential contamination / environmental risk site(s) intersecting this parcel.`
    };
  } catch (err: any) {
    return {
      key: "osp-pollution-risks",
      title: "Environmental & Pollution Risks",
      source: "OSP potencialus_tarsos_zidiniai FeatureServer",
      status: "error",
      items: [],
      note: `Error querying pollution risk geodata: ${err instanceof Error ? err.message : String(err)}`
    };
  }
}
