import { NextRequest, NextResponse } from 'next/server';
import { getGooglePlayConfig } from '../../../../../../src/google-play/config.js';
import { googlePlay } from '../../../../../../src/google-play/client.js';
import { isGooglePlayAdminRequest } from '../../../../../../src/google-play/security.js';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  if (!isGooglePlayAdminRequest(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { packageName, serviceAccount } = getGooglePlayConfig();
  if (!packageName || !serviceAccount) return NextResponse.json({ error: 'Google Play integration is not configured' }, { status: 503 });
  try {
    const result = await googlePlay.voidedPurchases(packageName, request.nextUrl.searchParams.get('pageToken') || undefined);
    return NextResponse.json(result, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    console.error('Google Play voided-purchases lookup failed', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'Voided-purchases lookup failed' }, { status: 502 });
  }
}