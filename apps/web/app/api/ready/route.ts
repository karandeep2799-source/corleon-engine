import { NextResponse } from 'next/server';
import { prisma } from '../../../../../src/cashflow/prisma.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const noStore = { 'Cache-Control': 'no-store, max-age=0' };

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      {
        status: 'not_ready',
        service: 'corleon-engine',
        app: 'web',
        checks: { database: 'not_configured' },
        timestamp: new Date().toISOString(),
      },
      { status: 503, headers: noStore },
    );
  }

  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json(
      {
        status: 'ready',
        service: 'corleon-engine',
        app: 'web',
        checks: { database: 'ok' },
        timestamp: new Date().toISOString(),
      },
      { headers: noStore },
    );
  } catch {
    // Do not return database error details: drivers can include hostnames or credentials.
    console.error('Corleon readiness check failed: database unavailable');

    return NextResponse.json(
      {
        status: 'not_ready',
        service: 'corleon-engine',
        app: 'web',
        checks: { database: 'unavailable' },
        timestamp: new Date().toISOString(),
      },
      { status: 503, headers: noStore },
    );
  }
}
