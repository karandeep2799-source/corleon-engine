import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  sandboxPrisma?: PrismaClient;
};

export const db =
  globalForPrisma.sandboxPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.sandboxPrisma = db;
}
