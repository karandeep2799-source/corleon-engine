import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

const markets = [
  { id: 'US_STOCKS', label: 'US stocks', currency: 'USD' },
  { id: 'INDIAN_EQUITIES', label: 'NSE / BSE', currency: 'INR' },
  { id: 'CRYPTO', label: 'Crypto', currency: 'USD' },
  { id: 'FOREX', label: 'Forex', currency: 'USD' },
  { id: 'COMMODITIES', label: 'Commodities', currency: 'INR' },
] as const;

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const connections = await db.brokerConnection.findMany({
    where: { userId: session.userId, status: 'ACTIVE' },
    select: { provider: true, market: true, status: true },
  });
  return NextResponse.json({
    markets: markets.map((market) => ({
      ...market,
      connected: connections.some((c) => c.market === market.id),
      marketData: 'NOT_CONFIGURED',
      liveExecution: 'DISABLED_UNTIL_PROVIDER_VALIDATION',
    })),
    generatedAt: new Date().toISOString(),
  });
}
