import { createHash } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
const globalForPrisma = globalThis as unknown as { googlePlayPrisma?: PrismaClient };
export const prisma = globalForPrisma.googlePlayPrisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.googlePlayPrisma = prisma;
export const hashPurchaseToken = (token: string) => createHash('sha256').update(token, 'utf8').digest('hex');
function asDate(value: unknown) {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const parsed = typeof value === 'string' && /^\d{10,}$/.test(value) ? Number(value) : value;
  const date = new Date(parsed);
  return Number.isNaN(date.getTime()) ? undefined : date;
}
export function isSubscriptionEntitled(data: Record<string, unknown>, now = new Date()) {
  const state = data.subscriptionState;
  if (state === 'SUBSCRIPTION_STATE_ACTIVE' || state === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD') return true;
  if (state !== 'SUBSCRIPTION_STATE_CANCELED') return false;
  const lines = Array.isArray(data.lineItems) ? data.lineItems as Array<Record<string, unknown>> : [];
  return lines.some((line) => { const expiry = asDate(line.expiryTime); return Boolean(expiry && expiry > now); });
}
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
  const safeProviderData: Record<string, unknown> = {
    purchaseState: data.purchaseState, purchaseTimeMillis: data.purchaseTimeMillis,
    orderId, latestOrderId: data.latestOrderId, subscriptionState: data.subscriptionState,
    acknowledgementState: data.acknowledgementState, consumptionState: data.consumptionState,
    lineItems: lines.map((item) => ({ productId: item.productId, expiryTime: item.expiryTime })),
  };
  const fields = {
    productId, purchaseKind: input.kind, purchaseState: state, orderId,
    subscriptionState: typeof data.subscriptionState === 'string' ? data.subscriptionState : undefined,
    acknowledgementState: typeof data.acknowledgementState === 'string' ? data.acknowledgementState : undefined,
    consumptionState: typeof data.consumptionState === 'string' ? data.consumptionState : undefined,
    purchasedAt: purchased, expiresAt: expiry, providerData: safeProviderData as Prisma.InputJsonValue,
  };
  const saved = await prisma.googlePlayPurchase.upsert({
    where: { packageName_purchaseTokenHash: { packageName: input.packageName, purchaseTokenHash } },
    create: { packageName: input.packageName, purchaseTokenHash, ...fields },
    update: { ...fields, lastVerifiedAt: new Date() },
  });
  await prisma.googlePlayAuditLog.create({
    data: { action: input.kind === 'PRODUCT' ? 'PRODUCT_PURCHASE_VERIFIED' : 'SUBSCRIPTION_REFRESHED', packageName: input.packageName, resourceId: saved.id, outcome: 'SUCCESS', metadata: { purchaseState: state, productId } },
  });
  return saved;
}
export async function markVoidedPurchase(packageName: string, token: string, reason?: unknown) {
  const purchaseTokenHash = hashPurchaseToken(token);
  const existing = await prisma.googlePlayPurchase.findUnique({ where: { packageName_purchaseTokenHash: { packageName, purchaseTokenHash } } });
  if (!existing) return false;
  await prisma.googlePlayPurchase.update({
    where: { id: existing.id },
    data: { purchaseState: 'VOIDED', ...(existing.purchaseKind === 'SUBSCRIPTION' ? { subscriptionState: 'SUBSCRIPTION_STATE_CANCELED' } : {}), lastVerifiedAt: new Date() },
  });
  const metadata = typeof reason === 'number' || typeof reason === 'string' ? { reason } : {};
  await prisma.googlePlayAuditLog.create({ data: { action: 'PURCHASE_VOIDED', packageName, resourceId: existing.id, outcome: 'SUCCESS', metadata } });
  return true;
}