// Standalone ingestion script for the LKMP forest-cutting-permits dataset —
// deliberately run as its own OS process (spawned by lkmp-service.ts), not
// imported and called in-process.
//
// Downloading + decompressing + tokenizing ~200MB of GeoJSON, even streamed,
// pushes the JS engine's resident set up to a few GB while it runs (measured
// live). That's fine for a short-lived batch job, but a JS allocator does not
// hand freed pages back to the OS afterward — in the long-running server
// process, that peak would become a permanent floor for the rest of the
// process's life. Running it as a child process means the OS reclaims all of
// that the moment this script exits; the main server's memory footprint never
// moves.
import { createInflateRaw } from "node:zlib";
import { Readable } from "node:stream";
import { chainUnchecked, none } from "stream-chain";
import { parser } from "stream-json";
import { pick } from "stream-json/filters/pick.js";
import { streamArray } from "stream-json/streamers/stream-array.js";
import { prisma } from "../db";
import { geometryBbox, type LkmpGeometry } from "../services/lkmp-geometry";

const LKMP_ZIP_URL = "https://lkmp.alisas.lt/static/lkmp-data.geojson.zip";

type LkmpPermitProperties = {
  id: string;
  tipas: string;
  galioja_nuo: string | null;
  galioja_iki: string | null;
  kadastrinis_nr: string | null;
  padalinys: string | null;
  girininkija: string | null;
  kvartalas: number | string | null;
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

type LkmpFeature = {
  type: "Feature";
  properties: LkmpPermitProperties;
  geometry: LkmpGeometry;
};

// Minimal single-entry ZIP reader: parses the local file header directly
// rather than pulling in a zip dependency for what is always exactly one
// deflated file. Returns a readable STREAM of the entry's decompressed bytes,
// not a buffer — keeps the whole pipeline below streaming end-to-end.
function openFirstZipEntryStream(zipBytes: Uint8Array): NodeJS.ReadableStream {
  const view = new DataView(zipBytes.buffer, zipBytes.byteOffset, zipBytes.byteLength);
  if (view.getUint32(0, true) !== 0x04034b50) {
    throw new Error("LKMP archive is not a valid ZIP (missing local file header)");
  }
  const method = view.getUint16(8, true);
  const compressedSize = view.getUint32(18, true);
  const nameLen = view.getUint16(26, true);
  const extraLen = view.getUint16(28, true);
  const dataStart = 30 + nameLen + extraLen;
  const payload = zipBytes.subarray(dataStart, dataStart + compressedSize);

  if (method === 0) return Readable.from([Buffer.from(payload)]);
  if (method === 8) {
    const inflate = createInflateRaw();
    inflate.end(payload);
    return inflate;
  }
  throw new Error(`Unsupported ZIP compression method ${method} in LKMP archive`);
}

function toRow(feature: LkmpFeature) {
  const bbox = geometryBbox(feature.geometry);
  const p = feature.properties;
  return {
    id: p.id,
    tipas: p.tipas,
    galiojaNuo: p.galioja_nuo,
    galiojaIki: p.galioja_iki,
    kadastrinisNr: p.kadastrinis_nr,
    padalinys: p.padalinys,
    girininkija: p.girininkija,
    kvartalas: p.kvartalas == null ? null : String(p.kvartalas),
    sklypas: p.sklypas,
    kertamasPlotas: p.kertamas_plotas,
    vyraujantysMedziai: p.vyraujantys_medziai,
    kirtimoRusis: p.kirtimo_rusis,
    atkurimoBudas: p.atkurimo_budas,
    nuosavybesForma: p.nuosavybes_forma,
    leidBusena: p.leid_busena,
    turis: p.turis,
    savivaldybe: p.savivaldybe,
    minLng: bbox.minLng,
    minLat: bbox.minLat,
    maxLng: bbox.maxLng,
    maxLat: bbox.maxLat,
    geometry: JSON.stringify(feature.geometry),
  };
}

// Replaces the whole table with a fresh snapshot. Not wrapped in one giant
// interactive transaction (147k rows would risk the default transaction
// timeout); a brief window where the table is empty mid-refresh is an
// acceptable tradeoff for this best-effort, non-critical dataset.
async function refreshDataset(): Promise<void> {
  const response = await fetch(LKMP_ZIP_URL, { signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(`HTTP ${response.status} fetching LKMP archive`);
  const zipBytes = new Uint8Array(await response.arrayBuffer());
  const entryStream = openFirstZipEntryStream(zipBytes);

  await prisma.forestCuttingPermit.deleteMany({});

  const chunkSize = 2000;
  // A handful of ids repeat in the source (observed live); SQLite's
  // createMany has no skipDuplicates support, so de-duplicate up front —
  // keeping the first occurrence — instead of failing the whole ingest.
  const seenIds = new Set<string>();
  let chunk: ReturnType<typeof toRow>[] = [];
  let total = 0;

  // chainUnchecked: stream-json's stage types (TokenSource, StreamArrayItem<unknown>)
  // don't line up with stream-chain's strict tuple inference, even though this is
  // exactly stream-json's own documented composition pattern. Runtime behaviour is
  // unaffected — this only bypasses the (currently overly strict) compile-time check.
  const pipeline = chainUnchecked([
    entryStream,
    parser(),
    pick({ filter: "features" }),
    streamArray(),
    async ({ value: feature }: { value: LkmpFeature }) => {
      if (!seenIds.has(feature.properties.id)) {
        seenIds.add(feature.properties.id);
        chunk.push(toRow(feature));
        if (chunk.length >= chunkSize) {
          await prisma.forestCuttingPermit.createMany({ data: chunk });
          total += chunk.length;
          chunk = [];
        }
      }
      return none;
    },
  ]);

  await new Promise<void>((resolve, reject) => {
    // Nothing reads the chain's output side (the final stage drops every
    // value via `none`) — without a 'data' listener the readable half stays
    // paused and never drains, so 'end' would never fire.
    pipeline.on("data", () => {});
    pipeline.on("end", resolve);
    pipeline.on("error", reject);
  });

  if (chunk.length > 0) {
    await prisma.forestCuttingPermit.createMany({ data: chunk });
    total += chunk.length;
  }

  await prisma.forestCuttingDatasetMeta.upsert({
    where: { id: 1 },
    update: { fetchedAt: new Date() },
    create: { id: 1, fetchedAt: new Date() },
  });

  console.log(`[refresh-lkmp-permits] Ingested ${total} forest-cutting permit rows.`);
}

try {
  await refreshDataset();
  await prisma.$disconnect();
  process.exit(0);
} catch (err) {
  console.error("[refresh-lkmp-permits] Failed:", err);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
}
