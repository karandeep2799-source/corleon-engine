import { NextRequest, NextResponse } from 'next/server';
import { getGooglePlayConfig } from '../../../../../../../src/google-play/config.js';
import { googlePlay } from '../../../../../../../src/google-play/client.js';
import { persistPurchase } from '../../../../../../../src/google-play/store.js';
import { isGooglePlayAdminRequest } from '../../../../../../../src/google-play/security.js';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  if (!isGooglePlayAdminRequest(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { packageName, serviceAccount } = getGooglePlayConfig();
  if (!packageName || !serviceAccount) return NextResponse.json({ error: 'Google Play integration is not configured' }, { status: 503 });
  try {
    const { token } = await context.params;
    if (!token || token.length > 4096) return NextResponse.json({ error: 'Invalid purchase token' }, { status: 400 });
    const data = await googlePlay.subscription(packageName, token);
    const saved = await persistPurchase({ packageName, token, kind: 'SUBSCRIPTION', data });
    return NextResponse.json({ subscription: { id: saved.id, state: saved.subscriptionState, productId: saved.productId, orderId: saved.orderId, expiresAt: saved.expiresAt, lastVerifiedAt: saved.lastVerifiedAt } }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    console.error('Google Play subscription lookup failed', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'Subscription lookup failed' }, { status: 502 });
  }
}