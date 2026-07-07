import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "path";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const rawUrl = process.env.DATABASE_URL || "file:./dev.db";
const match = rawUrl.match(/^file:(.+)$/);
const dbPath = match
  ? `file:${path.resolve(process.cwd(), match[1])}`
  : rawUrl;

const adapter = new PrismaLibSql({ url: dbPath });

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
