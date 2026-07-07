import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    if (!globalForPrisma.prisma) {
      const connectionString =
        process.env.DATABASE_URL ||
        process.env.POSTGRES_PRISMA_URL ||
        process.env.POSTGRES_URL ||
        "";

      if (connectionString) {
        try {
          const adapter = new PrismaNeon({ connectionString });
          globalForPrisma.prisma = new PrismaClient({ adapter });
        } catch (e) {
          console.error("Failed to create Neon PrismaClient:", e);
          globalForPrisma.prisma = new PrismaClient();
        }
      } else {
        globalForPrisma.prisma = new PrismaClient();
      }
    }
    const value = (globalForPrisma.prisma as any)[prop];
    if (typeof value === "function") {
      return value.bind(globalForPrisma.prisma);
    }
    return value;
  },
});
