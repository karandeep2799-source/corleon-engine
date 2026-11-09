import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { corleonPrisma?: PrismaClient };

export const prisma = globalForPrisma.corleonPrisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.corleonPrisma = prisma;
