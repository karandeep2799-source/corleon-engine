import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { taskosPrisma?: PrismaClient };
export const db = globalForPrisma.taskosPrisma ?? new PrismaClient({ log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'] });
if (process.env.NODE_ENV !== 'production') globalForPrisma.taskosPrisma = db;
