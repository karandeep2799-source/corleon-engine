import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  let userId: string;
  try {
    ({ userId } = await requireSession());
  } catch {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const policies = await db.riskLimit.findMany({
    where: { userId },
    orderBy: { market: 'asc' },
    select: {
      market: true,
      maxOrderNotional: true,
      maxDailyNotional: true,
      maxOpenOrders: true,
      tradingEnabled: true,
      requireLimitOrders: true,
      updatedAt: true,
    },
  });
  return NextResponse.json({ policies, globalExecutionEnabled: process.env.LIVE_TRADING_ENABLED === 'true' });
}
