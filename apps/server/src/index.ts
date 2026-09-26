import { RPCHandler } from "@orpc/server/fetch";
import { appRouter } from "./router";
import { env } from "./env";
import { prisma } from "./db";
import { join } from "node:path";

// Ensure DB schema exists without relying on prisma CLI at runtime.
// Idempotent — safe to run on every startup.
await prisma.$executeRawUnsafe(`
  CREATE TABLE IF NOT EXISTS "ParcelReport" (
    "id"             TEXT NOT NULL PRIMARY KEY,
    "address"        TEXT NOT NULL,
    "cadastralRegNo" TEXT NOT NULL,
    "coordinates"    TEXT NOT NULL,
    "reportData"     TEXT NOT NULL,
    "pdfCachedPath" TEXT,
    "createdAt"      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);
await prisma.$executeRawUnsafe(
  `CREATE UNIQUE INDEX IF NOT EXISTS "ParcelReport_cadastralRegNo_key" ON "ParcelReport"("cadastralRegNo")`
);
await prisma.$executeRawUnsafe(
  `CREATE INDEX IF NOT EXISTS "ParcelReport_cadastralRegNo_idx" ON "ParcelReport"("cadastralRegNo")`
);
await prisma.$executeRawUnsafe(
  `CREATE INDEX IF NOT EXISTS "ParcelReport_address_idx" ON "ParcelReport"("address")`
);
await prisma.$executeRawUnsafe(`
  CREATE TABLE IF NOT EXISTS "ForestCuttingPermit" (
    "id"                 TEXT NOT NULL PRIMARY KEY,
    "tipas"              TEXT NOT NULL,
    "galiojaNuo"         TEXT,
    "galiojaIki"         TEXT,
    "kadastrinisNr"      TEXT,
    "padalinys"          TEXT,
    "girininkija"        TEXT,
    "kvartalas"          TEXT,
    "sklypas"            TEXT,
    "kertamasPlotas"     REAL,
    "vyraujantysMedziai" TEXT,
    "kirtimoRusis"       TEXT,
    "atkurimoBudas"      TEXT,
    "nuosavybesForma"    TEXT,
    "leidBusena"         TEXT,
    "turis"              REAL,
    "savivaldybe"        TEXT,
    "minLng"             REAL NOT NULL,
    "minLat"             REAL NOT NULL,
    "maxLng"             REAL NOT NULL,
    "maxLat"             REAL NOT NULL,
    "geometry"           TEXT NOT NULL
  )
`);
await prisma.$executeRawUnsafe(
  `CREATE INDEX IF NOT EXISTS "ForestCuttingPermit_kadastrinisNr_idx" ON "ForestCuttingPermit"("kadastrinisNr")`
);
await prisma.$executeRawUnsafe(
  `CREATE INDEX IF NOT EXISTS "ForestCuttingPermit_minLng_maxLng_idx" ON "ForestCuttingPermit"("minLng", "maxLng")`
);
await prisma.$executeRawUnsafe(
  `CREATE INDEX IF NOT EXISTS "ForestCuttingPermit_minLat_maxLat_idx" ON "ForestCuttingPermit"("minLat", "maxLat")`
);
await prisma.$executeRawUnsafe(`
  CREATE TABLE IF NOT EXISTS "ForestCuttingDatasetMeta" (
    "id"        INTEGER NOT NULL PRIMARY KEY,
    "fetchedAt" DATETIME NOT NULL
  )
`);
console.log("[DB] Schema ready.");

const rpcHandler = new RPCHandler(appRouter);
const port = env.PORT;

const server = Bun.serve({
  port,
  fetch: async (request) => {
    const { pathname } = new URL(request.url);

    if (pathname.startsWith("/rpc")) {
      const result = await rpcHandler.handle(request, { prefix: "/rpc" });

      if (result.matched) {
        return result.response;
      }
    }

    if (pathname.startsWith("/api/pdf/")) {
      const filename = pathname.slice("/api/pdf/".length);
      if (filename.includes("..") || filename.includes("/")) {
        return new Response("Invalid filename", { status: 400 });
      }
      const filePath = join(process.cwd(), "generated", "pdf", filename);
      const file = Bun.file(filePath);
      if (await file.exists()) {
        return new Response(file, {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `inline; filename="${filename}"`,
          },
        });
      } else {
        return new Response("File not found", { status: 404 });
      }
    }

    if (pathname === "/api/health") {
      return Response.json({ ok: true, service: "zeme-server" });
    }

    return new Response("Not found", { status: 404 });
  },
});

console.log(`zeme server listening on http://localhost:${server.port}`);
