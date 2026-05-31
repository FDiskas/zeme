import { defineConfig } from "prisma/config";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { env } from "./src/env";

export default defineConfig({
  schema: "./prisma/schema.prisma",
  datasource: {
    url: env.DATABASE_URL,
  },
  migrate: {
    async adapter() {
      return new PrismaLibSql({ url: env.DATABASE_URL });
    },
  },
});
