import { $ } from "bun";
import fs from "node:fs";
import path from "node:path";

async function main() {
  let schemaUrl = "https://boundaries.biip.lt/openapi.json";

  // Load from .env.local if present
  const envPath = path.resolve(".env.local");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf8");
    const match = content.match(/BIIP_SCHEMA_URL=(.+)/);
    if (match?.[1]) {
      schemaUrl = match[1].trim();
    }
  }

  console.log(`Downloading OpenAPI schema from ${schemaUrl}...`);

  const res = await fetch(schemaUrl);
  if (!res.ok) {
    throw new Error(`Failed to download schema: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();

  // Ensure config directory exists
  const configDir = path.resolve("config", "apis");
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  // Save the schema
  const schemaPath = path.join(configDir, "biip.json");
  fs.writeFileSync(schemaPath, JSON.stringify(data, null, 2));
  console.log(`OpenAPI schema successfully saved to: ${schemaPath}`);

  // Run openapi-ts to generate SDK inside apps/server/src/services/biip
  console.log("Generating SDK using openapi-ts...");
  const outputDir = path.resolve("apps", "server", "src", "services", "biip");

  await $`npx openapi-ts -i ${schemaPath} -o ${outputDir}`;
  console.log(`SDK generated successfully at: ${outputDir}`);
}

main().catch((err) => {
  console.error("Error generating BIIP SDK:", err);
  process.exit(1);
});
