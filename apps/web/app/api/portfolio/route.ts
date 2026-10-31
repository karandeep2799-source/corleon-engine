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

  const accounts = await db.tradingAccount.findMany({
    where: { userId, status: 'ACTIVE' },
    orderBy: { createdAt: 'asc' },
    include: {
      positions: { orderBy: { symbol: 'asc' } },
      _count: { select: { orders: true } },
    },
  });
  return NextResponse.json({
    accounts: accounts.map((account) => ({
      id: account.id,
      name: account.name,
      baseCurrency: account.baseCurrency,
      positions: account.positions,
      orderCount: account._count.orders,
      balances: null,
      valuation: null,
      valuationStatus: 'AWAITING_BROKER_SYNC',
    })),
  });
}
