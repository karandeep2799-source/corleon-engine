import { PrismaClient } from "@prisma/client";
const globalForPrisma = globalThis as unknown as { agentRuntimePrisma?: PrismaClient };
export const prisma = globalForPrisma.agentRuntimePrisma ?? new PrismaClient({ log: process.env.NODE_ENV === "development" ? ["error","warn"] : ["error"] });
if (process.env.NODE_ENV !== "production") globalForPrisma.agentRuntimePrisma = prisma;
