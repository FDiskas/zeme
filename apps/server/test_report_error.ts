import { buildComprehensiveReport } from "./src/services/report-service";

async function run() {
  const cadastral = "4400/0001:6353";
  console.log("Simulating report build for:", cadastral);
  try {
    const report = await buildComprehensiveReport(cadastral, "Vilniaus r. sav., Rudaminos sen., Kalviškių k., Žalioji g. 16A");
    console.log("SUCCESS! Report built:", JSON.stringify(report, null, 2).slice(0, 500));
  } catch (err: any) {
    console.error("FATAL ERROR CAUGHT:", err);
    if (err.stack) {
      console.error(err.stack);
    }
  }
}

run().catch(console.error);
