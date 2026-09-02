import { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';

const D = (value) => new Prisma.Decimal(value ?? 0);

function commissionAmount(revenue, rule) {
  const amount = D(revenue);
  if (rule.fixedAmount != null) return D(rule.fixedAmount);
  if (rule.rate != null) return amount.mul(D(rule.rate)).div(100);
  return D(0);
}

async function ensureBalance(tx, affiliateId, currency) {
  return tx.affiliateBalance.upsert({
    where: { affiliateId },
    create: { affiliateId, currency },
    update: {}
  });
}

export async function recordBillingEvent(input) {
  const {
    organizationId,
    provider,
    externalId,
    type,
    customerExternalId,
    customerEmail,
    customerName,
    orderExternalId,
    amount,
    currency,
    occurredAt = new Date(),
    subscriptionExternalId,
    rawPayload
  } = input;

  return prisma.$transaction(async (tx) => {
    const existing = await tx.billingEvent.findUnique({
      where: { provider_externalId: { provider, externalId } },
      include: { commissions: true }
    });
    if (existing) return existing;

    const customer = await tx.customer.upsert({
      where: { organizationId_externalId: { organizationId, externalId: customerExternalId } },
      create: {
        organizationId,
        externalId: customerExternalId,
        email: customerEmail,
        name: customerName
      },
      update: { email: customerEmail ?? undefined, name: customerName ?? undefined }
    });

    let order = null;
    if (orderExternalId) {
      order = await tx.order.upsert({
        where: { organizationId_externalId: { organizationId, externalId: orderExternalId } },
        create: {
          organizationId,
          customerId: customer.id,
          externalId: orderExternalId,
          amount: D(amount),
          currency,
          status: type === 'PAYMENT' ? 'PAID' : 'PENDING',
          provider
        },
        update: { amount: D(amount), status: type === 'PAYMENT' ? 'PAID' : undefined }
      });
    }

    let subscription = null;
    if (subscriptionExternalId) {
      subscription = await tx.subscription.findUnique({
        where: { organizationId_externalId: { organizationId, externalId: subscriptionExternalId } }
      });
    }

    const event = await tx.billingEvent.create({
      data: {
        organizationId,
        customerId: customer.id,
        orderId: order?.id,
        subscriptionId: subscription?.id,
        externalId,
        provider,
        type,
        amount: D(amount),
        currency,
        occurredAt,
        rawPayload,
        status: 'PROCESSING'
      }
    });

    if (['PAYMENT', 'SUBSCRIPTION_STARTED', 'SUBSCRIPTION_RENEWED', 'SUBSCRIPTION_UPGRADED'].includes(type)) {
      await createCommissionForEvent(tx, event.id);
    }

    return tx.billingEvent.update({
      where: { id: event.id },
      data: { status: 'PROCESSED', processedAt: new Date() },
      include: { commissions: true }
    });
  });
}

async function createCommissionForEvent(tx, billingEventId) {
  const event = await tx.billingEvent.findUnique({
    where: { id: billingEventId },
    include: { customer: true, order: true }
  });
  if (!event) throw new Error('Billing event not found');

  const attribution = await tx.attribution.findFirst({
    where: {
      customerId: event.customerId,
      status: 'ACTIVE',
      OR: [{ expiresAt: null }, { expiresAt: { gt: event.occurredAt } }]
    },
    orderBy: [{ lastTouch: 'desc' }, { attributedAt: 'desc' }]
  });
  if (!attribution) return null;

  const affiliate = await tx.affiliate.findUnique({
    where: { id: attribution.affiliateId },
    include: { program: { include: { commissionRules: true } } }
  });
  if (!affiliate || affiliate.status !== 'ACTIVE') return null;

  const rule = affiliate.program.commissionRules.find((r) => r.active) ?? {
    id: null,
    type: 'ONE_TIME',
    rate: affiliate.program.defaultCommissionRate,
    fixedAmount: null,
    recurring: false
  };

  const amount = commissionAmount(event.amount, rule);
  if (amount.lte(0)) return null;

  const holdUntil = new Date(event.occurredAt.getTime() + affiliate.program.holdDays * 86400000);

  const commission = await tx.commission.create({
    data: {
      organizationId: affiliate.organizationId,
      affiliateId: affiliate.id,
      billingEventId: event.id,
      orderId: event.orderId,
      ruleId: rule.id,
      type: rule.type,
      source: 'BILLING_EVENT',
      status: 'PENDING',
      revenueAmount: event.amount,
      commissionRate: rule.rate,
      amount,
      currency: event.currency,
      holdUntil
    }
  });

  await ensureBalance(tx, affiliate.id, event.currency);
  await tx.affiliateBalance.update({
    where: { affiliateId: affiliate.id },
    data: { pendingAmount: { increment: amount } }
  });

  await tx.ledgerEntry.create({
    data: {
      organizationId: affiliate.organizationId,
      affiliateId: affiliate.id,
      commissionId: commission.id,
      type: 'COMMISSION',
      status: 'POSTED',
      amount,
      currency: event.currency,
      description: `Commission for billing event ${event.externalId}`,
      idempotencyKey: `commission:${commission.id}`
    }
  });

  return commission;
}

export async function releaseHeldCommissions(now = new Date(), limit = 500) {
  const commissions = await prisma.commission.findMany({
    where: { status: 'PENDING', holdUntil: { lte: now } },
    take: limit,
    orderBy: { holdUntil: 'asc' }
  });

  let released = 0;
  for (const commission of commissions) {
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.commission.findUnique({ where: { id: commission.id } });
      if (!fresh || fresh.status !== 'PENDING' || !fresh.holdUntil || fresh.holdUntil > now) return;

      await tx.commission.update({
        where: { id: fresh.id },
        data: { status: 'AVAILABLE', approvedAt: now, availableAt: now }
      });

      await tx.affiliateBalance.update({
        where: { affiliateId: fresh.affiliateId },
        data: {
          pendingAmount: { decrement: fresh.amount },
          approvedAmount: { increment: fresh.amount },
          availableAmount: { increment: fresh.amount }
        }
      });
      released++;
    });
  }
  return { released };
}

export async function reverseCommission(commissionId, reason = 'Reversal') {
  return prisma.$transaction(async (tx) => {
    const original = await tx.commission.findUnique({ where: { id: commissionId } });
    if (!original) throw new Error('Commission not found');
    if (original.status === 'REVERSED' || original.status === 'VOIDED') return original;

    const reversal = await tx.commission.create({
      data: {
        organizationId: original.organizationId,
        affiliateId: original.affiliateId,
        billingEventId: original.billingEventId,
        orderId: original.orderId,
        type: original.type,
        source: 'ADJUSTMENT',
        status: 'REVERSED',
        revenueAmount: original.revenueAmount.neg(),
        commissionRate: original.commissionRate,
        amount: original.amount.neg(),
        currency: original.currency,
        parentId: original.id,
        reversedAt: new Date(),
        metadata: { reason }
      }
    });

    const wasPending = original.status === 'PENDING';
    const wasAvailable = ['APPROVED', 'AVAILABLE'].includes(original.status);
    const wasPaid = original.status === 'PAID';

    await tx.commission.update({
      where: { id: original.id },
      data: { status: 'REVERSED', reversedAt: new Date() }
    });

    const balanceDelta = {
      ...(wasPending ? { pendingAmount: { decrement: original.amount } } : {}),
      ...(wasAvailable ? { availableAmount: { decrement: original.amount }, reversedAmount: { increment: original.amount } } : {}),
      ...(wasPaid ? { reversedAmount: { increment: original.amount } } : {})
    };
    if (Object.keys(balanceDelta).length) {
      await tx.affiliateBalance.update({ where: { affiliateId: original.affiliateId }, data: balanceDelta });
    }

    await tx.ledgerEntry.create({
      data: {
        organizationId: original.organizationId,
        affiliateId: original.affiliateId,
        commissionId: reversal.id,
        type: 'COMMISSION_REVERSAL',
        status: 'POSTED',
        amount: original.amount.neg(),
        currency: original.currency,
        description: reason,
        idempotencyKey: `reversal:${original.id}`
      }
    });

    return reversal;
  });
}

export async function createPayout({ organizationId, affiliateId, payoutAccountId, method, currency }) {
  return prisma.$transaction(async (tx) => {
    const affiliate = await tx.affiliate.findUnique({
      where: { id: affiliateId },
      include: { program: true, balance: true }
    });
    if (!affiliate?.balance) throw new Error('Affiliate balance not found');

    const amount = D(affiliate.balance.availableAmount);
    if (amount.lte(0)) throw new Error('No available balance');
    if (amount.lt(D(affiliate.program.minimumPayout))) throw new Error('Minimum payout threshold not reached');

    const commissions = await tx.commission.findMany({
      where: { affiliateId, status: 'AVAILABLE', currency },
      orderBy: { availableAt: 'asc' }
    });
    if (!commissions.length) throw new Error('No payable commissions');

    const payout = await tx.payout.create({
      data: {
        organizationId,
        affiliateId,
        payoutAccountId,
        method,
        status: 'PENDING',
        amount,
        fee: D(0),
        netAmount: amount,
        currency,
        requestedAt: new Date()
      }
    });

    for (const commission of commissions) {
      await tx.payoutItem.create({
        data: { payoutId: payout.id, affiliateId, commissionId: commission.id, amount: commission.amount, currency }
      });
      await tx.commission.update({ where: { id: commission.id }, data: { status: 'PAID', paidAt: new Date() } });
    }

    await tx.affiliateBalance.update({
      where: { affiliateId },
      data: { availableAmount: { decrement: amount }, paidAmount: { increment: amount } }
    });

    await tx.ledgerEntry.create({
      data: {
        organizationId,
        affiliateId,
        payoutId: payout.id,
        type: 'PAYOUT',
        status: 'POSTED',
        amount: amount.neg(),
        currency,
        description: `Payout ${payout.id}`,
        idempotencyKey: `payout:${payout.id}`
      }
    });

    return payout;
  });
}
