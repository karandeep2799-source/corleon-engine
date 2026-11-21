import { NextResponse } from 'next/server';
import { prisma } from '../../../../../src/cashflow/prisma.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const checkedAt = new Date().toISOString();

  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    return NextResponse.json({
      status: 'ok',
      service: 'corleon-engine',
      app: 'web',
      database: 'connected',
      checkedAt,
    }, {
      status: 200,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (error) {
    console.error('Health check database probe failed', error instanceof Error ? error.name : 'UnknownError');
    return NextResponse.json({
      status: 'degraded',
      service: 'corleon-engine',
      app: 'web',
      database: 'unavailable',
      checkedAt,
    }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  }
}
