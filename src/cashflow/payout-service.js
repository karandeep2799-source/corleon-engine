import { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';
import { getPayoutProvider } from './payout-providers.js';

const D = (v) => new Prisma.Decimal(v ?? 0);

export async function executePayout(payoutId) {
  const payout = await prisma.payout.findUnique({
    where: { id: payoutId },
    include: { affiliate: true, payoutAccount: true }
  });
  if (!payout) throw new Error('Payout not found');
  if (['PAID', 'CANCELLED'].includes(payout.status)) return payout;
  if (!payout.payoutAccount) throw new Error('Payout account is required');
  if (payout.payoutAccount.status !== 'VERIFIED') throw new Error('Payout account is not verified');

  const provider = getPayoutProvider(payout.method);
  const destination = payout.payoutAccount.externalAccountId;
  if (payout.method === 'STRIPE' && !destination) throw new Error('Stripe connected account is required');

  await prisma.payout.update({ where: { id: payoutId }, data: { status: 'PROCESSING' } });

  try {
    const result = await provider.send({
      amount: payout.netAmount,
      currency: payout.currency,
      destination,
      metadata: { payoutId: payout.id, affiliateId: payout.affiliateId, idempotencyKey: `payout-provider:${payout.id}` }
    });

    return prisma.$transaction(async (tx) => {
      const fresh = await tx.payout.findUnique({ where: { id: payoutId } });
      if (!fresh) throw new Error('Payout disappeared');
      if (fresh.status === 'PAID') return fresh;

      const paid = result.status === 'PAID';
      const updated = await tx.payout.update({
        where: { id: payoutId },
        data: {
          status: paid ? 'PAID' : 'PROCESSING',
          externalId: result.externalId,
          processedAt: new Date(),
          paidAt: paid ? new Date() : null
        }
      });

      if (!paid) return updated;

      await tx.ledgerEntry.upsert({
        where: { idempotencyKey: `payout:${payout.id}` },
        create: {
          organizationId: payout.organizationId,
          affiliateId: payout.affiliateId,
          payoutId: payout.id,
          type: 'PAYOUT',
          status: 'POSTED',
          amount: D(payout.netAmount).neg(),
          currency: payout.currency,
          description: `Provider payout ${result.externalId}`,
          idempotencyKey: `payout:${payout.id}`
        },
        update: {}
      });

      await tx.financialRecord.upsert({
        where: { idempotencyKey: `payout:${payout.id}` },
        create: {
          organizationId: payout.organizationId,
          externalId: result.externalId ?? payout.id,
          provider: payout.method,
          type: 'EXPENSE',
          status: 'POSTED',
          amount: D(payout.netAmount),
          currency: payout.currency,
          occurredAt: payout.paidAt ?? new Date(),
          description: `Affiliate payout ${payout.id}`,
          category: 'AFFILIATE_PAYOUT',
          source: 'PAYOUT',
          idempotencyKey: `payout:${payout.id}`,
          metadata: { payoutId: payout.id, providerExternalId: result.externalId ?? null }
        },
        update: {}
      });

      return updated;
    });
  } catch (error) {
    await prisma.payout.update({
      where: { id: payoutId },
      data: { status: 'FAILED', failureReason: error instanceof Error ? error.message : String(error) }
    });
    throw error;
  }
}