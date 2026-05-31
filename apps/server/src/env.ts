import path from "node:path";
import { fileURLToPath } from "node:url";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const defaultDatabaseUrl = `file:${path.resolve(currentDir, "../prisma/dev.db")}`;

const databaseUrlSchema = z
  .string()
  .min(1)
  .refine(
    (value) => value.startsWith("file:") || URL.canParse(value),
    "DATABASE_URL must be a valid URL or a file: path",
  );

export const env = createEnv({
  server: {
    PORT: z.coerce.number().int().min(1).max(65535).default(8787),
    DATABASE_URL: databaseUrlSchema.default(defaultDatabaseUrl),
    DISABLE_PDF: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    BIIP_BASE_URL: z
      .string()
      .url()
      .default("https://boundaries.biip.lt"),
  },
  runtimeEnvStrict: {
    PORT: process.env.PORT,
    DATABASE_URL: process.env.DATABASE_URL,
    DISABLE_PDF: process.env.DISABLE_PDF,
    BIIP_BASE_URL: process.env.BIIP_BASE_URL,
  },
  emptyStringAsUndefined: true,
});

void env;