import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { requireSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { getBrokerAdapter } from '@/lib/trading/registry';
import { validatePreTrade } from '@/lib/trading/risk';
import { MARKETS, type OrderRequest } from '@/lib/trading/types';

export const runtime = 'nodejs';

const schema = z.object({
  accountId: z.string().min(1),
  market: z.enum(MARKETS),
  symbol: z.string().min(1).max(32).transform((v) => v.toUpperCase()),
  provider: z.string().min(2).max(64),
  side: z.enum(['BUY', 'SELL']),
  orderType: z.enum(['MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT']),
  quantity: z.string().regex(/^\d+(\.\d{1,10})?$/),
  limitPrice: z.string().optional(),
  stopPrice: z.string().optional(),
  timeInForce: z.enum(['DAY', 'GTC', 'IOC']).default('DAY'),
});

export async function POST(request: Request) {
  let userId: string;
  try {
    ({ userId } = await requireSession());
  } catch {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const origin = request.headers.get('origin');
  if (!origin || new URL(origin).origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: 'Cross-origin request rejected' }, { status: 403 });
  }

  const idempotencyKey = request.headers.get('idempotency-key');
  if (!idempotencyKey || idempotencyKey.length < 16 || idempotencyKey.length > 128) {
    return NextResponse.json({ error: 'A unique Idempotency-Key header (16–128 chars) is required' }, { status: 400 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid order request', details: parsed.error.flatten() }, { status: 400 });
  const input: OrderRequest = { ...parsed.data, idempotencyKey };
  const account = await db.tradingAccount.findFirst({ where: { id: input.accountId, userId, status: 'ACTIVE' } });
  if (!account) return NextResponse.json({ error: 'Trading account not found' }, { status: 404 });

  const connection = await db.brokerConnection.findFirst({
    where: { userId, provider: input.provider, market: input.market, status: 'ACTIVE', secretRef: { not: null } },
  });
  if (!connection?.secretRef) return NextResponse.json({ error: 'No verified broker connection for this market. Live order rejected.', code: 'BROKER_NOT_CONNECTED' }, { status: 409 });

  const risk = await db.riskLimit.findUnique({ where: { userId_market: { userId, market: input.market } } });
  if (!risk) return NextResponse.json({ error: 'Risk limits must be configured before trading', code: 'RISK_LIMITS_MISSING' }, { status: 409 });

  try {
    await validatePreTrade(input, risk);
    const openOrders = await db.order.count({
      where: { accountId: account.id, status: { in: ['PENDING', 'ACCEPTED', 'PARTIALLY_FILLED'] } },
    });
    if (openOrders >= risk.maxOpenOrders) throw new Error('MAX_OPEN_ORDERS_EXCEEDED');
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'RISK_CHECK_FAILED';
    await db.auditEvent.create({ data: { userId, actorType: 'USER', action: 'ORDER_REJECTED', resource: 'ORDER', outcome: 'DENIED', metadata: { market: input.market, symbol: input.symbol, reason } } });
    return NextResponse.json({ error: 'Order rejected by pre-trade controls', reason }, { status: 422 });
  }

  if (process.env.LIVE_TRADING_ENABLED !== 'true') {
    return NextResponse.json({ error: 'Live execution is globally disabled. Complete provider certification and compliance review first.', code: 'LIVE_TRADING_DISABLED' }, { status: 423 });
  }

  const adapter = getBrokerAdapter(input.provider);
  if (!adapter || !adapter.isConfigured || !adapter.supportedMarkets.includes(input.market)) {
    return NextResponse.json({ error: 'No certified execution adapter is installed for this provider and market. No order was sent.', code: 'ADAPTER_UNAVAILABLE' }, { status: 503 });
  }

  const requestHash = createHash('sha256').update(JSON.stringify(input)).digest('hex');
  const prior = await db.idempotencyRecord.findUnique({ where: { userId_key: { userId, key: idempotencyKey } } });
  if (prior) {
    if (prior.requestHash !== requestHash) return NextResponse.json({ error: 'Idempotency key reused with a different order payload' }, { status: 409 });
    if (prior.response) return NextResponse.json(prior.response, { status: 200 });
    return NextResponse.json({ error: 'An order with this idempotency key is still being reconciled. Do not submit a new key.', code: 'ORDER_IN_PROGRESS' }, { status: 409 });
  }

  try {
    await db.idempotencyRecord.create({
      data: { userId, key: idempotencyKey, requestHash, status: 'IN_PROGRESS', expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
    });
  } catch {
    return NextResponse.json({ error: 'Duplicate or concurrent order request. Check order history before retrying.', code: 'IDEMPOTENCY_CONFLICT' }, { status: 409 });
  }

  try {
    const result = await adapter.submitOrder(input, connection.secretRef);
    const order = await db.order.create({
      data: {
        userId, accountId: account.id, brokerConnectionId: connection.id, provider: input.provider,
        market: input.market, symbol: input.symbol, side: input.side, orderType: input.orderType,
        timeInForce: input.timeInForce, quantity: new Prisma.Decimal(input.quantity),
        limitPrice: input.limitPrice ? new Prisma.Decimal(input.limitPrice) : null,
        stopPrice: input.stopPrice ? new Prisma.Decimal(input.stopPrice) : null,
        status: result.status, externalOrderId: result.externalOrderId, idempotencyKey,
        submittedAt: result.submittedAt,
      },
    });
    const responseBody = { orderId: order.id, externalOrderId: result.externalOrderId, status: result.status };
    await db.$transaction([
      db.idempotencyRecord.update({ where: { userId_key: { userId, key: idempotencyKey } }, data: { status: result.status, response: responseBody } }),
      db.auditEvent.create({ data: { userId, actorType: 'USER', action: 'ORDER_SUBMITTED', resource: 'ORDER', resourceId: order.id, outcome: result.status, metadata: { provider: input.provider, market: input.market, symbol: input.symbol } } }),
    ]);
    return NextResponse.json(responseBody, { status: result.status === 'ACCEPTED' ? 202 : 422 });
  } catch {
    await db.idempotencyRecord.update({
      where: { userId_key: { userId, key: idempotencyKey } },
      data: { status: 'UNKNOWN', response: { error: 'Broker execution outcome unknown; reconcile with the broker before retrying.' } },
    }).catch(() => undefined);
    await db.auditEvent.create({ data: { userId, actorType: 'USER', action: 'ORDER_EXECUTION_UNKNOWN', resource: 'ORDER', outcome: 'RECONCILIATION_REQUIRED', metadata: { provider: input.provider, market: input.market, symbol: input.symbol } } }).catch(() => undefined);
    return NextResponse.json({ error: 'Broker execution outcome unknown. Do not retry with a new key; reconcile broker activity first.', code: 'EXECUTION_OUTCOME_UNKNOWN' }, { status: 502 });
  }
}
