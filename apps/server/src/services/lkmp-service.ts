import { join } from "node:path";
import { prisma } from "../db";
import {
  emptyBbox,
  geometryIntersectsRing,
  ringBbox,
  toDigitsCadastralKey,
  type BBox,
  type LkmpGeometry,
  type Ring,
} from "./lkmp-geometry";

// Miško kirtimo leidimai / biržės (forest-cutting permits & stands) — the actual
// authoritative source behind atvira.amvmt.lt's daily-updated map. Published as a
// single static GeoJSON, zipped, ~200MB uncompressed, ~150k features nationwide.
// Most state-forest "biržė" (stand) features carry NO cadastral number at all —
// they only exist as a polygon over forest compartment/stand (kvartalas/sklypas),
// so matching a land parcel requires an actual polygon-polygon intersection, not
// an attribute filter. Privately-owned "sklypas" features do carry a cadastral
// number directly and are matched by that instead (cheaper, and exact).
//
// There is no live, filtered query endpoint for this dataset (unlike GRPK/KVR/
// ASGR) — it's a bulk daily snapshot, ingested by a SEPARATE OS process (see
// scripts/refresh-lkmp-permits.ts) into SQLite, not held here in memory. Two
// reasons it's a child process rather than an in-process download+parse:
//   1. Steady-state RAM: bbox columns are indexed for a cheap SQL pre-filter,
//      and only the handful of bbox-matched rows' geometry gets parsed per
//      request, so serving requests never touches the full dataset.
//   2. Ingestion RAM: even streamed, decompressing+tokenizing the ~200MB
//      snapshot pushes the JS engine's RSS up several GB while it runs
//      (measured live) — the allocator does not hand that back to the OS
//      afterward. Doing it in a short-lived child process means the OS
//      reclaims all of it the moment that process exits; this long-running
//      server's own footprint never moves.
const REFRESH_SCRIPT_PATH = join(import.meta.dir, "..", "scripts", "refresh-lkmp-permits.ts");

// Source refreshes roughly once a day (observed Last-Modified ~01:00). Checked
// lazily on request rather than on a cron: whichever request first notices the
// stored snapshot is >24h old kicks off a refresh.
const REFRESH_INTERVAL_MS = 1000 * 60 * 60 * 24;

let refreshing: Promise<void> | null = null;

async function runRefreshScript(): Promise<void> {
  const proc = Bun.spawn(["bun", "run", REFRESH_SCRIPT_PATH], {
    stdout: "inherit",
    stderr: "inherit",
    env: process.env,
  });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`LKMP refresh script exited with code ${exitCode}`);
  }
}

async function ensureFresh(): Promise<void> {
  const meta = await prisma.forestCuttingDatasetMeta.findUnique({ where: { id: 1 } });

  if (!meta) {
    // Never fetched: nothing to serve yet, must wait for the first ingest.
    await runRefreshScript();
    return;
  }

  const isStale = Date.now() - meta.fetchedAt.getTime() > REFRESH_INTERVAL_MS;
  if (isStale && !refreshing) {
    refreshing = runRefreshScript()
      .catch((err) => {
        console.error("Failed to refresh LKMP forest-cutting data:", err);
      })
      .finally(() => {
        refreshing = null;
      });
  }
  // Stale-but-present data is served as-is while the refresh runs in the
  // background — same tradeoff as every other panel's cache-freshness check.
}

export type LkmpMatch = {
  id: string;
  tipas: string;
  galioja_nuo: string | null;
  galioja_iki: string | null;
  kadastrinis_nr: string | null;
  padalinys: string | null;
  girininkija: string | null;
  kvartalas: string | null;
  sklypas: string | null;
  kertamas_plotas: number | null;
  vyraujantys_medziai: string | null;
  kirtimo_rusis: string | null;
  atkurimo_budas: string | null;
  nuosavybes_forma: string | null;
  leid_busena: string | null;
  turis: number | null;
  savivaldybe: string | null;
};

// Finds every forest-cutting stand/permit touching the given parcel: an exact
// cadastral-number match when the source carries one directly (private land),
// otherwise a real polygon-polygon intersection against the parcel outline
// (state forest stands, which are addressed by kvartalas/sklypas, not cadastral
// number). The SQL query only pre-filters by bounding box (indexed columns);
// the precise polygon test happens in JS against just those candidate rows —
// never more than a handful, so this stays cheap regardless of dataset size.
export async function findForestCuttingPermits(
  cadastralRegNo: string,
  parcelOuterRing: Ring,
): Promise<LkmpMatch[]> {
  await ensureFresh();

  const cadastralKey = toDigitsCadastralKey(cadastralRegNo);
  const parcelBbox: BBox = emptyBbox();
  ringBbox(parcelOuterRing, parcelBbox);

  const candidates = await prisma.forestCuttingPermit.findMany({
    where: {
      minLng: { lte: parcelBbox.maxLng },
      maxLng: { gte: parcelBbox.minLng },
      minLat: { lte: parcelBbox.maxLat },
      maxLat: { gte: parcelBbox.minLat },
    },
  });

  const matches: LkmpMatch[] = [];
  for (const row of candidates) {
    const rowCadastralKey = row.kadastrinisNr ? toDigitsCadastralKey(row.kadastrinisNr) : undefined;
    const cadastralHit =
      cadastralKey !== undefined && rowCadastralKey !== undefined && cadastralKey === rowCadastralKey;

    const geometry = JSON.parse(row.geometry) as LkmpGeometry;
    if (cadastralHit || geometryIntersectsRing(geometry, parcelOuterRing)) {
      matches.push({
        id: row.id,
        tipas: row.tipas,
        galioja_nuo: row.galiojaNuo,
        galioja_iki: row.galiojaIki,
        kadastrinis_nr: row.kadastrinisNr,
        padalinys: row.padalinys,
        girininkija: row.girininkija,
        kvartalas: row.kvartalas,
        sklypas: row.sklypas,
        kertamas_plotas: row.kertamasPlotas,
        vyraujantys_medziai: row.vyraujantysMedziai,
        kirtimo_rusis: row.kirtimoRusis,
        atkurimo_budas: row.atkurimoBudas,
        nuosavybes_forma: row.nuosavybesForma,
        leid_busena: row.leidBusena,
        turis: row.turis,
        savivaldybe: row.savivaldybe,
      });
    }
  }
  return matches;
}
