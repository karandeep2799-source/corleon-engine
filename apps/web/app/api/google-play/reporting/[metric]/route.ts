import { NextRequest, NextResponse } from 'next/server';
import { getGooglePlayConfig } from '../../../../../../../src/google-play/config.js';
import { googlePlay } from '../../../../../../../src/google-play/client.js';
import { isGooglePlayAdminRequest } from '../../../../../../../src/google-play/security.js';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest, context: { params: Promise<{ metric: string }> }) {
  if (!isGooglePlayAdminRequest(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { packageName, serviceAccount } = getGooglePlayConfig();
  if (!packageName || !serviceAccount) return NextResponse.json({ error: 'Google Play integration is not configured' }, { status: 503 });
  const { metric } = await context.params;
  if (metric !== 'crash-rate' && metric !== 'anr-rate') return NextResponse.json({ error: 'Supported metrics: crash-rate, anr-rate' }, { status: 400 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const set = metric === 'crash-rate' ? 'crashRateMetricSet' : 'anrRateMetricSet';
    return NextResponse.json(await googlePlay.queryVitals(packageName, set, body), { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    console.error('Google Play reporting query failed', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'Reporting query failed' }, { status: 502 });
  }
}