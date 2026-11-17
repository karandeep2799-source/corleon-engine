import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { releaseHeldCommissions } from '../../../../../../src/cashflow/engine.js';

export const runtime = 'nodejs';

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get('authorization');

  if (!secret || !authorization) return false;

  const expected = Buffer.from(`Bearer ${secret}`, 'utf8');
  const actual = Buffer.from(authorization, 'utf8');

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

async function handleCommissionRelease(request: NextRequest) {
  // Fail closed: scheduled commission releases stay disabled until CRON_SECRET is configured.
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await releaseHeldCommissions();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('Commission release failed', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Release failed' },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  return handleCommissionRelease(request);
}

export async function POST(request: NextRequest) {
  return handleCommissionRelease(request);
}
