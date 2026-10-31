import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { requireSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { getBrokerAdapter } from '@/lib/trading/registry';
import { validatePreTrade } from '@/lib/trading/risk';
import { MARKETS } from '@/lib/trading/types';

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

  const idempotencyKey = request.headers.get('idempotency-key');
  if (!idempotencyKey || idempotencyKey.length < 16 || idempotencyKey.length > 128) {
    return NextResponse.json({ error: 'A unique Idempotency-Key header (16–128 chars) is required' }, { status: 400 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid order request', details: parsed.error.flatten() }, { status: 400 });
  const input = { ...parsed.data, idempotencyKey };
  const account = await db.tradingAccount.findFirst({ where: { id: input.accountId, userId, status: 'ACTIVE' } });
  if (!account) return NextResponse.json({ error: 'Trading account not found' }, { status: 404 });

  const connection = await db.brokerConnection.findFirst({
    where: { userId, provider: input.provider, market: input.market, status: 'ACTIVE', secretRef: { not: null } },
  });
  if (!connection) return NextResponse.json({ error: 'No verified broker connection for this market. Live order rejected.', code: 'BROKER_NOT_CONNECTED' }, { status: 409 });

  const risk = await db.riskLimit.findUnique({ where: { userId_market: { userId, market: input.market } } });
  if (!risk) return NextResponse.json({ error: 'Risk limits must be configured before trading', code: 'RISK_LIMITS_MISSING' }, { status: 409 });

  try {
    await validatePreTrade(input, risk);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'RISK_CHECK_FAILED';
    await db.auditEvent.create({ data: { userId, actorType: 'USER', action: 'ORDER_REJECTED', resource: 'ORDER', outcome: 'DENIED', metadata: { market: input.market, symbol: input.symbol, reason } } });
    return NextResponse.json({ error: 'Order rejected by pre-trade controls', reason }, { status: 422 });
  }

  if (process.env.LIVE_TRADING_ENABLED !== 'true') {
    return NextResponse.json({ error: 'Live execution is globally disabled. Enable only after provider certification and compliance review.', code: 'LIVE_TRADING_DISABLED' }, { status: 423 });
  }

  const adapter = getBrokerAdapter(input.provider);
  if (!adapter || !adapter.supportedMarkets.includes(input.market)) {
    return NextResponse.json({ error: 'No certified execution adapter is installed for this provider and market', code: 'ADAPTER_UNAVAILABLE' }, { status: 503 });
  }

  const requestHash = Buffer.from(JSON.stringify(input)).toString('base64url');
  const prior = await db.idempotencyRecord.findUnique({ where: { userId_key: { userId, key: idempotencyKey } } });
  if (prior) {
    if (prior.requestHash !== requestHash) return NextResponse.json({ error: 'Idempotency key reused with a different order payload' }, { status: 409 });
    return NextResponse.json({ status: prior.status, result: prior.response }, { status: 200 });
  }

  try {
    const created = await db.order.create({
      data: {
        userId, accountId: account.id, brokerConnectionId: connection.id, provider: input.provider,
        market: input.market, symbol: input.symbol, side: input.side, orderType: input.orderType,
        timeInForce: input.timeInForce, quantity: new Prisma.Decimal(input.quantity),
        limitPrice: input.limitPrice ? new Prisma.Decimal(input.limitPrice) : null,
        stopPrice: input.stopPrice ? new Prisma.Decimal(input.stopPrice) : null,
        status: 'PENDING', idempotencyKey,
      },
    });
    // No adapter in this build is certified for real execution. The registry fails closed.
    await db.order.update({ where: { id: created.id }, data: { status: 'REJECTED', rejectionReason: 'LIVE_ADAPTER_NOT_CONFIGURED' } });
    await db.auditEvent.create({ data: { userId, actorType: 'USER', action: 'ORDER_REJECTED', resource: 'ORDER', resourceId: created.id, outcome: 'DENIED', metadata: { provider: input.provider, market: input.market } } });
    return NextResponse.json({ error: 'Live broker adapter is not configured; no order was sent.', code: 'LIVE_ADAPTER_NOT_CONFIGURED' }, { status: 503 });
  } catch {
    return NextResponse.json({ error: 'Order processing failed safely. Verify broker activity before retrying.' }, { status: 500 });
  }
}
