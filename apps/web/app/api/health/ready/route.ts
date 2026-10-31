import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: 'ready', dependencies: { database: 'reachable' } });
  } catch {
    return NextResponse.json({ status: 'not_ready', dependencies: { database: 'unavailable' } }, { status: 503 });
  }
}
