import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let prismaClient: PrismaClient | undefined;

function getPrisma(): PrismaClient {
  if (prismaClient) return prismaClient;

  const connectionString =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL ||
    "";

  if (connectionString) {
    try {
      const { PrismaNeon } = require("@prisma/adapter-neon") as typeof import("@prisma/adapter-neon");
      const adapter = new PrismaNeon({ connectionString });
      prismaClient = new PrismaClient({ adapter });
    } catch (e) {
      console.error("Failed to create Neon PrismaClient, falling back:", e);
      prismaClient = new PrismaClient();
    }
  } else {
    prismaClient = new PrismaClient();
  }

  return prismaClient;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrisma();
    const value = (client as any)[prop];
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});
