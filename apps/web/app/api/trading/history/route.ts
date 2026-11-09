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

  const orders = await db.order.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true, market: true, symbol: true, side: true, orderType: true,
      quantity: true, limitPrice: true, status: true, externalOrderId: true,
      rejectionReason: true, createdAt: true, submittedAt: true, filledAt: true,
    },
  });
  return NextResponse.json({ orders });
}
