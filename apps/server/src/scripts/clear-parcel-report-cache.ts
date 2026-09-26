// Wipes the entire ParcelReport cache. Every row is derived data (address,
// geometry, report panels) rebuilt on demand from BIIP/OSP/etc. — nothing
// here is a source of truth, so clearing it loses nothing except having to
// recompute a parcel the next time it's viewed.
//
// Used to recover from cache rows poisoned by a since-fixed bug in
// autocomplete.ts (a fabricated, collision-prone cadastral number could
// overwrite an unrelated real parcel's cached address/geometry). Clearing
// everything is simpler than picking out just the bad rows, and the next
// view of any parcel rebuilds it fresh through the fixed pipeline.
//
// Usage: bun run clear-parcel-report-cache
import { prisma } from "../db";

const { count } = await prisma.parcelReport.deleteMany({});
console.log(`[clear-parcel-report-cache] Deleted ${count} cached row(s).`);

await prisma.$disconnect();
process.exit(0);
