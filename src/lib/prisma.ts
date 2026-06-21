import { PrismaClient } from "../generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

// In Next.js, make sure the path to the database is absolute so it resolves correctly in all contexts
const dbPath = path.resolve(process.cwd(), "dev.db");
const url = `file:${dbPath}`;

const adapter = new PrismaBetterSqlite3({
  url,
});

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
