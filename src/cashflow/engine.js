import { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';

const D = (value) => new Prisma.Decimal(value ?? 0);

function normalizeCurrency(value) {
  const currency = String(value ?? '').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('A valid three-letter ISO currency code is required');
  return currency;
}

function commissionAmount(revenue, rule) {
  const amount = D(revenue);
  if (rule.fixedAmount != null) return D(rule.fixedAmount);
  if (rule.rate != null) return amount.mul(D(rule.rate)).div(100);
  return D(0);
}

async function ensureBalance(tx, affiliateId, currency) {
  const normalizedCurrency = normalizeCurrency(currency);
  const balance = await tx.affiliateBalance.upsert({ where: { affiliateId }, create: { affiliateId, currency: normalizedCurrency }, update: {} });
  if (normalizeCurrency(balance.currency) !== normalizedCurrency) {
    throw new Error('Multi-currency affiliate balances are not supported. Use one payout currency per affiliate.');
  }
  return balance;
}

export async function recordBillingEvent(input) {
  const { organizationId, provider, externalId, type, customerExternalId, customerEmail, customerName, orderExternalId, amount, currency, occurredAt = new Date(), subscriptionExternalId, rawPayload } = input;
  const normalizedCurrency = normalizeCurrency(currency);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.billingEvent.findUnique({ where: { provider_externalId: { provider, externalId } }, include: { commissions: true } });
    if (existing) return existing;

    const customer = await tx.customer.upsert({
      where: { organizationId_externalId: { organizationId, externalId: customerExternalId } },
      create: { organizationId, externalId: customerExternalId, email: customerEmail, name: customerName },
      update: { email: customerEmail ?? undefined, name: customerName ?? undefined }
    });

    let order = null;
    if (orderExternalId) {
      order = await tx.order.upsert({
        where: { organizationId_externalId: { organizationId, externalId: orderExternalId } },
        create: { organizationId, customerId: customer.id, externalId: orderExternalId, amount: D(amount), currency: normalizedCurrency, status: type === 'PAYMENT' ? 'PAID' : 'PENDING', provider, providerEventId: externalId },
        update: { amount: D(amount), status: type === 'PAYMENT' ? 'PAID' : undefined, providerEventId: externalId }
      });
    }

    let subscription = null;
    if (subscriptionExternalId) subscription = await tx.subscription.findUnique({ where: { organizationId_externalId: { organizationId, externalId: subscriptionExternalId } } });

    const event = await tx.billingEvent.create({
      data: { organizationId, customerId: customer.id, orderId: order?.id, subscriptionId: subscription?.id, externalId, provider, type, amount: D(amount), currency: normalizedCurrency, occurredAt, rawPayload, status: 'PROCESSING' }
    });

    if (['PAYMENT', 'SUBSCRIPTION_STARTED', 'SUBSCRIPTION_RENEWED', 'SUBSCRIPTION_UPGRADED'].includes(type)) await createCommissionForEvent(tx, event.id);

    return tx.billingEvent.update({ where: { id: event.id }, data: { status: 'PROCESSED', processedAt: new Date() }, include: { commissions: true } });
  });
}

async function createCommissionForEvent(tx, billingEventId) {
  const event = await tx.billingEvent.findUnique({ where: { id: billingEventId }, include: { customer: true, order: true } });
  if (!event) throw new Error('Billing event not found');

  const attribution = await tx.attribution.findFirst({
    where: { customerId: event.customerId, status: 'ACTIVE', OR: [{ expiresAt: null }, { expiresAt: { gt: event.occurredAt } }] },
    orderBy: [{ lastTouch: 'desc' }, { attributedAt: 'desc' }]
  });
  if (!attribution) return null;

  const affiliate = await tx.affiliate.findUnique({ where: { id: attribution.affiliateId }, include: { program: { include: { commissionRules: true } } } });
  if (!affiliate || affiliate.status !== 'ACTIVE') return null;

  const rule = affiliate.program.commissionRules.find((r) => r.active) ?? { id: null, type: 'ONE_TIME', rate: affiliate.program.defaultCommissionRate, fixedAmount: null };
  const amount = commissionAmount(event.amount, rule);
  if (amount.lte(0)) return null;

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
      holdUntil: new Date(event.occurredAt.getTime() + affiliate.program.holdDays * 86400000)
    }
  });

  await ensureBalance(tx, affiliate.id, event.currency);
  await tx.affiliateBalance.update({ where: { affiliateId: affiliate.id }, data: { pendingAmount: { increment: amount } } });
  await tx.ledgerEntry.create({
    data: { organizationId: affiliate.organizationId, affiliateId: affiliate.id, commissionId: commission.id, type: 'COMMISSION', status: 'POSTED', amount, currency: event.currency, description: `Commission for billing event ${event.externalId}`, idempotencyKey: `commission:${commission.id}` }
  });
  return commission;
}

export async function releaseHeldCommissions(now = new Date(), limit = 500) {
  const commissions = await prisma.commission.findMany({ where: { status: 'PENDING', holdUntil: { lte: now } }, take: limit, orderBy: { holdUntil: 'asc' } });
  let released = 0;
  for (const commission of commissions) {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.commission.updateMany({
        where: { id: commission.id, status: 'PENDING' },
        data: { status: 'AVAILABLE', approvedAt: now, availableAt: now }
      });
      if (claimed.count !== 1) return;
      const fresh = await tx.commission.findUnique({ where: { id: commission.id } });
      if (!fresh) throw new Error('Commission disappeared during release');
      await ensureBalance(tx, fresh.affiliateId, fresh.currency);
      await tx.affiliateBalance.update({
        where: { affiliateId: fresh.affiliateId },
        data: { pendingAmount: { decrement: fresh.amount }, approvedAmount: { increment: fresh.amount }, availableAmount: { increment: fresh.amount } }
      });
      released++;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
  return { released };
}

export async function reverseCommission(commissionId, reason = 'Reversal') {
  return prisma.$transaction(async (tx) => {
    const original = await tx.commission.findUnique({ where: { id: commissionId } });
    if (!original) throw new Error('Commission not found');
    if (['REVERSED', 'VOIDED'].includes(original.status)) return original;

    const reversal = await tx.commission.create({ data: {
      organizationId: original.organizationId, affiliateId: original.affiliateId, billingEventId: original.billingEventId, orderId: original.orderId,
      type: original.type, source: 'ADJUSTMENT', status: 'REVERSED', revenueAmount: original.revenueAmount.neg(), commissionRate: original.commissionRate,
      amount: original.amount.neg(), currency: original.currency, parentId: original.id, reversedAt: new Date(), metadata: { reason }
    } });

    const data = {};
    if (original.status === 'PENDING') data.pendingAmount = { decrement: original.amount };
    if (['APPROVED', 'AVAILABLE'].includes(original.status)) {
      data.approvedAmount = { decrement: original.amount };
      data.availableAmount = { decrement: original.amount };
      data.reversedAmount = { increment: original.amount };
    }
    if (original.status === 'PAID') data.reversedAmount = { increment: original.amount };

    await tx.commission.update({ where: { id: original.id }, data: { status: 'REVERSED', reversedAt: new Date() } });
    if (Object.keys(data).length) await tx.affiliateBalance.update({ where: { affiliateId: original.affiliateId }, data });
    await tx.ledgerEntry.create({ data: { organizationId: original.organizationId, affiliateId: original.affiliateId, commissionId: reversal.id, type: 'COMMISSION_REVERSAL', status: 'POSTED', amount: original.amount.neg(), currency: original.currency, description: reason, idempotencyKey: `reversal:${original.id}` } });
    return reversal;
  });
}

export async function createPayout({ organizationId, affiliateId, payoutAccountId, method, currency }) {
  const normalizedCurrency = normalizeCurrency(currency);
  if (!organizationId || !affiliateId || !payoutAccountId || !method) {
    throw new Error('Organization, affiliate, verified payout account, and payout method are required');
  }

  const transaction = () => prisma.$transaction(async (tx) => {
    const affiliate = await tx.affiliate.findUnique({
      where: { id: affiliateId },
      include: { program: true, balance: true }
    });
    if (!affiliate || affiliate.organizationId !== organizationId || affiliate.program?.organizationId !== organizationId) {
      throw new Error('Affiliate does not belong to this organization');
    }
    if (affiliate.status !== 'ACTIVE') throw new Error('Affiliate is not eligible for payouts');
    if (!affiliate.balance) throw new Error('Affiliate balance not found');
    if (normalizeCurrency(affiliate.balance.currency) !== normalizedCurrency) {
      throw new Error('Requested payout currency does not match the affiliate balance currency');
    }

    const activePayout = await tx.payout.findFirst({
      where: { organizationId, affiliateId, status: { in: ['PENDING', 'PROCESSING'] } },
      select: { id: true }
    });
    if (activePayout) throw new Error('An earlier payout is still pending or requires reconciliation');

    const payoutAccount = await tx.payoutAccount.findFirst({
      where: { id: payoutAccountId, affiliateId, method, status: 'VERIFIED' },
      select: { id: true }
    });
    if (!payoutAccount) throw new Error('A verified payout account matching this affiliate and method is required');

    const commissions = await tx.commission.findMany({
      where: { organizationId, affiliateId, status: 'AVAILABLE', currency: normalizedCurrency },
      orderBy: [{ availableAt: 'asc' }, { createdAt: 'asc' }]
    });
    const amount = commissions.reduce((sum, commission) => sum.plus(D(commission.amount)), D(0));
    if (amount.lte(0)) throw new Error('No available balance');
    if (!amount.eq(D(affiliate.balance.availableAmount))) {
      throw new Error('Balance/commission invariant failed; reconcile before payout');
    }
    if (amount.lt(D(affiliate.program.minimumPayout))) {
      throw new Error('Minimum payout threshold not reached');
    }

    const payout = await tx.payout.create({
      data: {
        organizationId, affiliateId, payoutAccountId, method, status: 'PENDING',
        amount, fee: D(0), netAmount: amount, currency: normalizedCurrency, requestedAt: new Date()
      }
    });

    for (const commission of commissions) {
      await tx.payoutItem.create({
        data: {
          payoutId: payout.id, affiliateId, commissionId: commission.id,
          amount: commission.amount, currency: normalizedCurrency
        }
      });
    }

    // Commissions and balances remain AVAILABLE until the provider confirms settlement.
    return payout;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await transaction();
    } catch (error) {
      if (error?.code !== 'P2034' || attempt === 3) throw error;
    }
  }

  throw new Error('Unable to safely create payout');
}
