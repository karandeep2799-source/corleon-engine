import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { bitcoinPrisma?: PrismaClient };

export const bitcoinPrisma = globalForPrisma.bitcoinPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.bitcoinPrisma = bitcoinPrisma;
