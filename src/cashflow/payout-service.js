import { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';
import { getPayoutProvider } from './payout-providers.js';

const D = (v) => new Prisma.Decimal(v ?? 0);

export async function executePayout(payoutId) {
  if (process.env.PAYOUT_EXECUTION_ENABLED !== 'true') {
    throw new Error('Payout execution is disabled. Enable it only after explicit operational approval.');
  }

  const initial = await prisma.payout.findUnique({
    where: { id: payoutId },
    include: { affiliate: true, payoutAccount: true }
  });
  if (!initial) throw new Error('Payout not found');
  if (initial.status === 'PAID' || initial.status === 'CANCELLED') return initial;
  if (initial.status !== 'PENDING') {
    throw new Error('Payout is already processing or requires manual reconciliation');
  }
  if (!initial.payoutAccount) throw new Error('Payout account is required');
  if (initial.payoutAccount.affiliateId !== initial.affiliateId ||
      initial.payoutAccount.method !== initial.method ||
      initial.payoutAccount.status !== 'VERIFIED') {
    throw new Error('Payout account ownership, method, or verification is invalid');
  }

  const provider = getPayoutProvider(initial.method);
  const destination = initial.payoutAccount.externalAccountId;
  if (initial.method === 'STRIPE' && !destination) {
    throw new Error('Stripe connected account is required');
  }

  // Only one worker can claim a PENDING payout. PROCESSING payouts need reconciliation.
  const claimed = await prisma.payout.updateMany({
    where: { id: payoutId, status: 'PENDING' },
    data: { status: 'PROCESSING', failureReason: null }
  });
  if (claimed.count !== 1) {
    throw new Error('Payout could not be claimed; reload the payout before retrying');
  }

  try {
    const result = await provider.send({
      amount: initial.netAmount,
      currency: initial.currency,
      destination,
      metadata: {
        payoutId: initial.id,
        affiliateId: initial.affiliateId,
        idempotencyKey: 'payout-provider:' + initial.id
      }
    });

    return await prisma.$transaction(async (tx) => {
      const fresh = await tx.payout.findUnique({ where: { id: payoutId } });
      if (!fresh) throw new Error('Payout disappeared');
      if (fresh.status === 'PAID') return fresh;

      if (result.status !== 'PAID') {
        return tx.payout.update({
          where: { id: payoutId },
          data: {
            status: 'PROCESSING',
            externalId: result.externalId,
            processedAt: new Date(),
            failureReason: 'Provider accepted the request but has not confirmed settlement.'
          }
        });
      }

      const items = await tx.payoutItem.findMany({
        where: { payoutId },
        include: { commission: true }
      });
      if (items.length === 0 || items.some((item) => !item.commission)) {
        throw new Error('Payout has no complete commission allocation');
      }

      const allocated = items.reduce((sum, item) => sum.plus(D(item.amount)), D(0));
      if (!allocated.eq(D(fresh.amount)) || !D(fresh.netAmount).eq(D(fresh.amount))) {
        throw new Error('Payout allocation does not match the requested settlement amount');
      }

      const now = new Date();
      for (const item of items) {
        const changed = await tx.commission.updateMany({
          where: {
            id: item.commissionId,
            organizationId: fresh.organizationId,
            affiliateId: fresh.affiliateId,
            status: 'AVAILABLE'
          },
          data: { status: 'PAID', paidAt: now }
        });
        if (changed.count !== 1) {
          throw new Error('A payout commission is no longer available; reconcile this transfer');
        }
        await tx.payoutItem.update({
          where: { id: item.id },
          data: { status: 'PAID' }
        });
      }

      const balance = await tx.affiliateBalance.findUnique({
        where: { affiliateId: fresh.affiliateId }
      });
      if (!balance || String(balance.currency).toUpperCase() !== String(fresh.currency).toUpperCase() ||
          D(balance.availableAmount).lt(D(fresh.amount))) {
        throw new Error('Affiliate balance does not cover the confirmed payout');
      }

      await tx.affiliateBalance.update({
        where: { affiliateId: fresh.affiliateId },
        data: {
          approvedAmount: { decrement: D(fresh.amount) },
          availableAmount: { decrement: D(fresh.amount) },
          paidAmount: { increment: D(fresh.amount) }
        }
      });

      const updated = await tx.payout.update({
        where: { id: payoutId },
        data: {
          status: 'PAID',
          externalId: result.externalId,
          processedAt: now,
          paidAt: now,
          failureReason: null
        }
      });

      await tx.ledgerEntry.upsert({
        where: { idempotencyKey: 'payout:' + fresh.id },
        create: {
          organizationId: fresh.organizationId,
          affiliateId: fresh.affiliateId,
          payoutId: fresh.id,
          type: 'PAYOUT',
          status: 'POSTED',
          amount: D(fresh.netAmount).neg(),
          currency: fresh.currency,
          description: 'Provider payout ' + result.externalId,
          idempotencyKey: 'payout:' + fresh.id
        },
        update: {}
      });

      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    // A timeout can happen after the provider accepts the transfer. Do not release funds here.
    await prisma.payout.update({
      where: { id: payoutId },
      data: {
        status: 'PROCESSING',
        failureReason: 'Provider result requires reconciliation. Do not create a replacement payout.'
      }
    });
    throw error;
  }
}
