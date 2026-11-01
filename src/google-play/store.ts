import { createHash } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
const globalForPrisma = globalThis as unknown as { googlePlayPrisma?: PrismaClient };
export const prisma = globalForPrisma.googlePlayPrisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.googlePlayPrisma = prisma;
export const hashPurchaseToken = (token: string) => createHash('sha256').update(token, 'utf8').digest('hex');
function asDate(value: unknown) { if (typeof value !== 'string' && typeof value !== 'number') return undefined; const date = new Date(value); return Number.isNaN(date.getTime()) ? undefined : date; }
export async function persistPurchase(input: { packageName: string; token: string; kind: 'PRODUCT' | 'SUBSCRIPTION'; productId?: string; data: Record<string, unknown> }) {
  const data = input.data;
  const lines = Array.isArray(data.lineItems) ? data.lineItems as Array<Record<string, unknown>> : [];
  const line = lines[0];
  const state = String(data.purchaseState ?? data.subscriptionState ?? data.paymentState ?? 'UNKNOWN');
  const orderId = typeof data.orderId === 'string' ? data.orderId : typeof data.latestOrderId === 'string' ? data.latestOrderId : undefined;
  const productId = input.productId || (typeof line?.productId === 'string' ? line.productId : undefined);
  const expiry = asDate(line?.expiryTime);
  const purchased = asDate(data.purchaseTimeMillis);
  const purchaseTokenHash = hashPurchaseToken(input.token);
  const fields = {
    productId, purchaseKind: input.kind, purchaseState: state, orderId,
    subscriptionState: typeof data.subscriptionState === 'string' ? data.subscriptionState : undefined,
    acknowledgementState: typeof data.acknowledgementState === 'string' ? data.acknowledgementState : undefined,
    consumptionState: typeof data.consumptionState === 'string' ? data.consumptionState : undefined,
    purchasedAt: purchased, expiresAt: expiry, providerData: data as object,
  };
  return prisma.googlePlayPurchase.upsert({
    where: { packageName_purchaseTokenHash: { packageName: input.packageName, purchaseTokenHash } },
    create: { packageName: input.packageName, purchaseTokenHash, ...fields },
    update: { ...fields, lastVerifiedAt: new Date() },
  });
}