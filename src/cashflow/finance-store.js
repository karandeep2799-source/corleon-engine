import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { prisma } from './prisma.js';

const D = (value) => new Prisma.Decimal(value ?? 0);
const ZERO = D(0);

const TYPE_TO_FIELD = Object.freeze({
  INCOME: 'income',
  EXPENSE: 'expenses',
  FEE: 'fees',
  REFUND: 'refunds',
  CHARGEBACK: 'chargebacks',
  TRANSFER: 'transfers',
  ADJUSTMENT: 'adjustments',
});

function assertMoneyInput(input) {
  if (!input?.organizationId) throw new Error('organizationId is required');
  if (!input?.currency) throw new Error('currency is required');
  if (!input?.type || !TYPE_TO_FIELD[input.type]) throw new Error(`Unsupported financial record type: ${input?.type}`);
  if (input.amount == null) throw new Error('amount is required');
  if (!input.idempotencyKey || input.idempotencyKey.length < 16 || input.idempotencyKey.length > 255) {
    throw new Error('idempotencyKey must be 16-255 characters');
  }
}

/** Persist one normalized financial movement. Safe to retry with the same idempotency key. */
export async function recordFinancialRecord(input) {
  assertMoneyInput(input);
  const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date();
  if (Number.isNaN(occurredAt.getTime())) throw new Error('occurredAt must be a valid date');

  return prisma.financialRecord.upsert({
    where: { idempotencyKey: input.idempotencyKey },
    create: {
      id: input.id ?? randomUUID(),
      organizationId: input.organizationId,
      externalId: input.externalId ?? null,
      provider: input.provider ?? null,
      type: input.type,
      status: input.status ?? 'POSTED',
      amount: D(input.amount),
      currency: input.currency.toUpperCase(),
      occurredAt,
      description: input.description ?? null,
      category: input.category ?? null,
      source: input.source ?? null,
      idempotencyKey: input.idempotencyKey,
      metadata: input.metadata ?? undefined,
    },
    update: {},
  });
}

/** Build and persist an as-of financial snapshot from normalized records plus affiliate balances. */
export async function saveFinanceSnapshot({ organizationId, currency, asOf = new Date() }) {
  const snapshotTime = new Date(asOf);
  if (Number.isNaN(snapshotTime.getTime())) throw new Error('asOf must be a valid date');
  const normalizedCurrency = currency.toUpperCase();

  const [records, balances] = await Promise.all([
    prisma.financialRecord.findMany({
      where: { organizationId, currency: normalizedCurrency, status: 'POSTED', occurredAt: { lte: snapshotTime } },
      select: { type: true, amount: true },
    }),
    prisma.affiliateBalance.findMany({
      where: { affiliate: { organizationId }, currency: normalizedCurrency },
      select: { pendingAmount: true, availableAmount: true, paidAmount: true },
    }),
  ]);

  const totals = {
    income: ZERO,
    expenses: ZERO,
    fees: ZERO,
    refunds: ZERO,
    chargebacks: ZERO,
    transfers: ZERO,
    adjustments: ZERO,
  };

  for (const record of records) {
    const field = TYPE_TO_FIELD[record.type];
    totals[field] = totals[field].plus(D(record.amount));
  }

  const net = totals.income
    .minus(totals.expenses)
    .minus(totals.fees)
    .minus(totals.refunds)
    .minus(totals.chargebacks)
    .plus(totals.adjustments);

  const affiliate = balances.reduce((acc, balance) => ({
    pending: acc.pending.plus(D(balance.pendingAmount)),
    available: acc.available.plus(D(balance.availableAmount)),
    paid: acc.paid.plus(D(balance.paidAmount)),
  }), { pending: ZERO, available: ZERO, paid: ZERO });

  return prisma.financeSnapshot.upsert({
    where: { organizationId_asOf_currency: { organizationId, asOf: snapshotTime, currency: normalizedCurrency } },
    create: {
      organizationId,
      asOf: snapshotTime,
      currency: normalizedCurrency,
      ...totals,
      net,
      availableAffiliateBalance: affiliate.available,
      pendingAffiliateBalance: affiliate.pending,
      paidAffiliateBalance: affiliate.paid,
      recordCount: records.length,
    },
    update: {
      ...totals,
      net,
      availableAffiliateBalance: affiliate.available,
      pendingAffiliateBalance: affiliate.pending,
      paidAffiliateBalance: affiliate.paid,
      recordCount: records.length,
    },
  });
}

export async function getFinanceSnapshot({ organizationId, currency, asOf = new Date() }) {
  return prisma.financeSnapshot.findUnique({
    where: { organizationId_asOf_currency: { organizationId, asOf: new Date(asOf), currency: currency.toUpperCase() } },
  });
}
