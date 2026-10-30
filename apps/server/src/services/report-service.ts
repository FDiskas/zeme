import { REPORT_PANEL_KEYS, type BuildingFootprint, type ParcelReport, type ReportPanelKey } from "@zeme/shared";
import {
  fetchBiipBoundary,
  fetchBiipAddresses,
  fetchGeoportalConstraints,
  fetchGrpkBuildings,
  fetchSznsRestrictions,
  fetchAsgrRegulations,
  fetchKvrData,
  fetchForestCuttingPermits,
  fetchBuiltUpRatios,
  buildPdbisPanel,
  geometryToEwkt,
  type UpstreamPanel,
} from "./connectors";
import {
  fetchOspParcelData,
  fetchOspBuildingPoints,
  getOspParcelSummaryPanel,
  getOspPollutionRisksPanel,
  fetchOspBuildingPermits,
  fetchNeighborParcels,
  formatUniqueNumber,
  type OspBuildingPoint,
} from "./osp-service";
import { getMarketValuePanel } from "./masvert-service";
import { addressPointsOf, fetchEnergyCertificates } from "./energy-certificates";
import {
  resolveParcelFromBiip,
  resolveAddressFromBiip,
  resolveParcelByCoordinates,
  resolveLocality,
  type ResolvedBiipAddresses,
} from "./biip-service";
import { parcelCentre } from "./geometry";
import {
  fetchNearbyServices,
  fetchCrimeStats,
  fetchFloodRisk,
  fetchCensusHouseholds,
  fetchBroadband,
} from "./neighbourhood-service";
import { describeUpstreamError } from "./upstream-error";

const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 30 * 6;

export function hasUsableGeometry(coordinates: ParcelReport["coordinates"]): boolean {
  const ring = coordinates.coordinates[0] ?? [];
  return ring.length >= 4;
}

// Detects legacy/placeholder addresses that must never be shown as real. Empty
// string is NOT a placeholder — it is the honest "this parcel has no street
// address" state. We never fabricate addresses, so new reports only ever carry a
// real address, an administrative-area label, or "".
export function isPlaceholderAddress(address: string): boolean {
  if (!address) return false;
  return (
    /^Parcel\s+.+$/i.test(address) ||
    /^Parcel\s+.+,\s+Lithuania$/i.test(address) ||
    address.startsWith("Address unavailable for")
  );
}

export function cacheAgeDays(from: Date): number {
  return Math.max(0, Math.floor((Date.now() - from.getTime()) / (1000 * 60 * 60 * 24)));
}

export function isCacheFresh(updatedAt: Date): boolean {
  return Date.now() - updatedAt.getTime() <= SIX_MONTHS_MS;
}

// Locality label for a parcel without a street address; "" when unknown.
export async function resolveLocalityOf(geometry: any): Promise<string> {
  const centre = parcelCentre(geometry);
  return centre ? resolveLocality(centre[0], centre[1]) : "";
}

// What a panel's lookup may need. The lookups several panels share (address
// points, OSP building points, GRPK footprints) run once, when the first
// panel asks for them.
export type PanelContext = {
  cadastralRegNo: string;
  address: string;
  coordinates: any;
  // Raw unique object number from OSP or BIIP; "" when neither had one.
  uniqueNumber: string;
  addressesPanel: () => Promise<UpstreamPanel>;
  ospBuildingPoints: () => Promise<OspBuildingPoint[]>;
  grpk: () => Promise<{ panel: UpstreamPanel; footprints: BuildingFootprint[] }>;
};

function once<T>(load: () => Promise<T>): () => Promise<T> {
  let result: Promise<T> | undefined;
  return () => (result ??= load());
}

export function panelContext(
  base: Pick<PanelContext, "cadastralRegNo" | "address" | "coordinates" | "uniqueNumber">,
  // undefined → the address points are looked up from the geometry.
  addressDetails?: ResolvedBiipAddresses | null,
  addressesPanel?: UpstreamPanel,
): PanelContext {
  const addresses = once(async () => {
    if (addressDetails !== undefined) return addressDetails;
    const ewkt = geometryToEwkt(base.coordinates);
    return ewkt ? resolveAddressFromBiip(ewkt) : null;
  });
  const ospBuildingPoints = once(() => fetchOspBuildingPoints(base.coordinates));
  return {
    ...base,
    addressesPanel: once(async () =>
      addressesPanel ?? fetchBiipAddresses(base.cadastralRegNo, base.coordinates, await addresses()),
    ),
    ospBuildingPoints,
    grpk: once(async () => {
      const [details, ospPoints] = await Promise.all([addresses(), ospBuildingPoints()]);
      return fetchGrpkBuildings(base.coordinates, details?.addresses ?? [], ospPoints);
    }),
  };
}

async function fetchOspPermitsPanel(ctx: PanelContext): Promise<UpstreamPanel> {
  const permits = await fetchOspBuildingPermits(ctx.cadastralRegNo, ctx.uniqueNumber || undefined);
  return {
    key: "osp-building-permits",
    title: "Statybos leidimai (Infostatyba)",
    source: "OSP infostatyba FeatureServer",
    status: "ok",
    items: permits,
    note: permits.length === 0
      ? "Oficialaus Infostatyba registro duomenyse šiam sklypui statybos leidimų nerasta."
      : `Rasta ${permits.length} statybos leidimo įrašų Infostatyba registre.`
  };
}

// Each panel's lookup, by key. Used for a whole report and for asking one
// failed source again.
export const PANEL_FETCHERS: Record<ReportPanelKey, (ctx: PanelContext) => Promise<UpstreamPanel>> = {
  "osp-parcel-summary": (ctx) => getOspParcelSummaryPanel(ctx.cadastralRegNo),
  "biip-boundary": (ctx) => fetchBiipBoundary(ctx.cadastralRegNo, ctx.address),
  "rc-masvert": (ctx) => getMarketValuePanel(formatUniqueNumber(ctx.uniqueNumber)),
  "biip-addresses": (ctx) => ctx.addressesPanel(),
  "grpk-buildings": async (ctx) => (await ctx.grpk()).panel,
  "ssva-built-up": (ctx) => fetchBuiltUpRatios(ctx.coordinates),
  "energy-certificates": async (ctx) => fetchEnergyCertificates(addressPointsOf(await ctx.addressesPanel())),
  "geoportal-constraints": (ctx) => fetchGeoportalConstraints(ctx.cadastralRegNo, ctx.address, ctx.coordinates),
  "asgr-regulations": (ctx) => fetchAsgrRegulations(ctx.coordinates),
  "szns-restrictions": (ctx) => fetchSznsRestrictions(ctx.coordinates),
  "kvr-heritage": (ctx) => fetchKvrData(ctx.cadastralRegNo, ctx.address, ctx.coordinates),
  "pdbis-building-data": async (ctx) => buildPdbisPanel(await ctx.ospBuildingPoints()),
  "osp-building-permits": fetchOspPermitsPanel,
  "osp-pollution-risks": (ctx) => getOspPollutionRisksPanel(ctx.coordinates),
  "forest-cutting-permits": (ctx) => fetchForestCuttingPermits(ctx.cadastralRegNo, ctx.coordinates),
  "nearby-services": (ctx) => fetchNearbyServices(ctx.coordinates),
  "crime-stats": (ctx) => fetchCrimeStats(ctx.coordinates),
  "flood-risk": (ctx) => fetchFloodRisk(ctx.coordinates),
  "census-households": (ctx) => fetchCensusHouseholds(ctx.coordinates),
  broadband: (ctx) => fetchBroadband(ctx.coordinates),
};

// One panel's lookup that never rejects: a source that throws becomes a
// failed panel with the reason, so the rest of the report still arrives.
export async function fetchPanel(key: ReportPanelKey, ctx: PanelContext): Promise<UpstreamPanel> {
  try {
    return await PANEL_FETCHERS[key](ctx);
  } catch (err) {
    console.error(`[Report] Panel ${key} failed:`, err);
    return { key, title: key, source: "", status: "error", items: [], note: `Klaida: ${describeUpstreamError(err)}` };
  }
}

// The panel context of a report already built (cached), for fetching a panel
// again or adding one the report lacks.
export function panelContextOf(report: ParcelReport): PanelContext {
  const item = (key: string) => report.reportPanels.find((p) => p.key === key)?.items[0] as
    | { uniqueNumber?: string | number }
    | undefined;
  const addresses = report.reportPanels.find((p) => p.key === "biip-addresses");
  return panelContext(
    {
      cadastralRegNo: report.cadastralRegNo,
      address: report.address,
      coordinates: report.coordinates,
      uniqueNumber: String(item("osp-parcel-summary")?.uniqueNumber ?? item("biip-boundary")?.uniqueNumber ?? ""),
    },
    undefined,
    addresses?.status === "ok" ? addresses : undefined,
  );
}

export type ReportProgress = {
  // The parcel is found: outline and address, no panels yet.
  parcel: (report: ParcelReport) => void;
  panel: (panel: UpstreamPanel) => void;
};

export async function buildComprehensiveReport(
  cadastralRegNo: string,
  address: string,
  existingCoordinates?: any,
  progress?: ReportProgress,
): Promise<ParcelReport> {
  // Resolved purely from this run's registry lookups — we never trust an incoming
  // address as a street address, and never fabricate one. hasStreetAddress stays
  // false unless BIIP gives us a real full address.
  let resolvedAddress = "";
  let hasStreetAddress = false;
  let resolvedCoordinates = existingCoordinates;

  const [biipParcel, ospParcel] = await Promise.all([
    resolveParcelFromBiip(cadastralRegNo),
    fetchOspParcelData(cadastralRegNo),
  ]);
  let parcel = biipParcel;

  if (!parcel && existingCoordinates) {
    const centre = parcelCentre(existingCoordinates);
    if (centre) {
      parcel = await resolveParcelByCoordinates(centre[0], centre[1]);
    }
  }

  let addressDetails: ResolvedBiipAddresses | null = null;
  if (parcel) {
    resolvedCoordinates = parcel.geometry;
    addressDetails = await resolveAddressFromBiip(parcel.ewkt);
    if (addressDetails?.fullAddress) {
      resolvedAddress = addressDetails.fullAddress;
      hasStreetAddress = true;
    }
  } else if (ospParcel && ospParcel.geometry) {
    // High-fidelity geometry from the State Data Agency (OSP). OSP gives only an
    // administrative-area label (savivaldybė / seniūnija), not a street address —
    // so this is an area label, not a street address.
    resolvedCoordinates = ospParcel.geometry;
    resolvedAddress = ospParcel.sen_pavad
      ? `${ospParcel.sav_pavad}, ${ospParcel.sen_pavad}`
      : (ospParcel.sav_pavad ?? "");
  }

  // Last resort: a non-placeholder address the caller already had (e.g. from a
  // prior cache). Shown as a label only — not treated as a verified street address.
  if (!resolvedAddress && !isPlaceholderAddress(address)) {
    resolvedAddress = address;
  }

  const targetCadastralRegNo = parcel ? parcel.cadastralRegNo : (ospParcel ? ospParcel.kadastro_nr : cadastralRegNo);

  // No usable geometry → honest empty polygon (no rings). The client then shows a
  // "location unknown" state instead of a confident pin at a fabricated point.
  const coordinates: ParcelReport["coordinates"] =
    resolvedCoordinates && hasUsableGeometry(resolvedCoordinates)
      ? resolvedCoordinates
      : { type: "Polygon", coordinates: [] };

  const found: ParcelReport = {
    cadastralRegNo: targetCadastralRegNo,
    address: resolvedAddress,
    hasStreetAddress,
    coordinates,
    fetchedAt: new Date().toISOString(),
    cached: false,
    sources: REPORT_SOURCES,
    reportPanels: [],
  };
  progress?.parcel(found);

  const ctx = panelContext(
    {
      cadastralRegNo: targetCadastralRegNo,
      address: resolvedAddress,
      coordinates: resolvedCoordinates,
      uniqueNumber: String(ospParcel?.unikalus_nr || parcel?.uniqueNumber || ""),
    },
    addressDetails,
  );

  const [reportPanels, neighbors, locality] = await Promise.all([
    Promise.all(
      REPORT_PANEL_KEYS.map(async (key) => {
        const panel = await fetchPanel(key, ctx);
        progress?.panel(panel);
        return panel;
      }),
    ),
    fetchNeighborParcels(resolvedCoordinates, targetCadastralRegNo).catch(() => []),
    hasStreetAddress ? Promise.resolve("") : resolveLocalityOf(resolvedCoordinates),
  ]);
  const footprints = (await ctx.grpk().catch(() => null))?.footprints ?? [];

  return {
    ...found,
    ...(locality ? { locality } : {}),
    buildings: footprints,
    neighbors,
    reportPanels,
  };
}

const REPORT_SOURCES = [
  "biip.lt",
  "Geoportal.lt GRPK",
  "Geoportal.lt rc_szns",
  "TPDR ASGR (planuojustatau.lt)",
  "KVR ArcGIS",
  "PDBIS",
  "OSP ntr_sklypai",
  "OSP infostatyba",
  "OSP tarsos_zidiniai",
  "Registrų centras masinis vertinimas",
  "lkmp.alisas.lt miško kirtimo leidimai",
  "IRD ugdymo įstaigos, nusikalstamų veikų ir administracinių nusižengimų registrai",
  "OSP gydymo įstaigos",
  "Aplinkos ministerija potvynių rizikos žemėlapiai",
  "OSP 2021 m. gyventojų ir būstų surašymas",
  "RRT fiksuotojo ryšio tinklai (data.gov.lt)",
  "SSVA pastatų bendrojo ploto ir sklypo santykis",
  "SSVA pastatų energinio naudingumo sertifikatai (data.gov.lt)",
];
