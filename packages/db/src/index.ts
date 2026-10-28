import { PrismaClient } from "../generated/client/index.js";

const globalForPrisma = globalThis as unknown as {
  corleonPrisma?: PrismaClient;
};

export const db =
  globalForPrisma.corleonPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.corleonPrisma = db;
}

export { Prisma, PrismaClient } from "../generated/client/index.js";
