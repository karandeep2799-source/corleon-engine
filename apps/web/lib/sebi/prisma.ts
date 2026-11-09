import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { sebiPrisma?: PrismaClient };
export const sebiPrisma = globalForPrisma.sebiPrisma ?? new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
});
if (process.env.NODE_ENV !== "production") globalForPrisma.sebiPrisma = sebiPrisma;
