import { NextRequest, NextResponse } from 'next/server';
import { getGooglePlayConfig } from '../../../../../../../src/google-play/config.js';
import { googlePlay } from '../../../../../../../src/google-play/client.js';
import { isSubscriptionEntitled, persistPurchase } from '../../../../../../../src/google-play/store.js';
import { isGooglePlayAdminRequest } from '../../../../../../../src/google-play/security.js';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  if (!isGooglePlayAdminRequest(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const config = getGooglePlayConfig();
  if (!config.packageName || !config.serviceAccount) return NextResponse.json({ error: 'Google Play integration is not configured' }, { status: 503 });
  try {
    const body = await request.json() as { productId?: string; purchaseToken?: string; kind?: string };
    const token = body.purchaseToken?.trim();
    if (!token || token.length > 4096) return NextResponse.json({ error: 'Valid purchaseToken is required' }, { status: 400 });
    if (body.kind === 'SUBSCRIPTION') {
      const data = await googlePlay.subscription(config.packageName, token);
      const entitled = isSubscriptionEntitled(data);
      const saved = await persistPurchase({ packageName: config.packageName, token, kind: 'SUBSCRIPTION', data });
      return NextResponse.json({ verified: entitled, purchase: { id: saved.id, productId: saved.productId, orderId: saved.orderId, subscriptionState: saved.subscriptionState, expiresAt: saved.expiresAt, lastVerifiedAt: saved.lastVerifiedAt } }, { status: entitled ? 200 : 409, headers: { 'cache-control': 'no-store' } });
    }
    const productId = body.productId?.trim();
    if (!productId || productId.length > 256) return NextResponse.json({ error: 'productId is required for product purchases' }, { status: 400 });
    const data = await googlePlay.productPurchase(config.packageName, productId, token);
    const purchaseState = Number(data.purchaseState);
    if (purchaseState !== 0) return NextResponse.json({ verified: false, reason: 'Purchase is not in the purchased state', purchaseState }, { status: 409 });
    const saved = await persistPurchase({ packageName: config.packageName, token, kind: 'PRODUCT', productId, data });
    return NextResponse.json({ verified: true, purchase: { id: saved.id, productId: saved.productId, orderId: saved.orderId, purchaseState: saved.purchaseState, lastVerifiedAt: saved.lastVerifiedAt } }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    console.error('Google Play purchase verification failed', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'Purchase verification failed' }, { status: 502 });
  }
}