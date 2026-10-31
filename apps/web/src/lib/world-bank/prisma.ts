import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  worldBankPrisma?: PrismaClient;
};

export const worldBankPrisma =
  globalForPrisma.worldBankPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.worldBankPrisma = worldBankPrisma;
}
