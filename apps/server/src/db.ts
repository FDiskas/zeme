import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { env } from "./env";

const adapter = new PrismaLibSql({ url: env.DATABASE_URL });

export const prisma = new PrismaClient({ adapter });
