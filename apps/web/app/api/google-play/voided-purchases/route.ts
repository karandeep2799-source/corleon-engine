import { NextRequest, NextResponse } from 'next/server';
import { getGooglePlayConfig } from '../../../../../../src/google-play/config';
import { googlePlay } from '../../../../../../src/google-play/client';
import { isGooglePlayAdminRequest } from '../../../../../../src/google-play/security';
import { markVoidedPurchase } from '../../../../../../src/google-play/store';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  if (!isGooglePlayAdminRequest(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { packageName, serviceAccount } = getGooglePlayConfig();
  if (!packageName || !serviceAccount) return NextResponse.json({ error: 'Google Play integration is not configured' }, { status: 503 });
  try {
    const result = await googlePlay.voidedPurchases(packageName, request.nextUrl.searchParams.get('pageToken') || undefined);
    const voided = Array.isArray(result.voidedPurchases) ? result.voidedPurchases as Array<Record<string, unknown>> : [];
    let revokedCount = 0;
    const safePurchases = [];
    for (const item of voided) {
      if (typeof item.purchaseToken === 'string' && await markVoidedPurchase(packageName, item.purchaseToken, item.voidedReason)) revokedCount += 1;
      safePurchases.push(Object.fromEntries(Object.entries(item).filter(([key]) => key !== 'purchaseToken')));
    }
    const pagination = Object.fromEntries(Object.entries(result).filter(([key]) => key !== 'voidedPurchases'));
    return NextResponse.json({ ...pagination, voidedPurchases: safePurchases, locallyRevokedCount: revokedCount }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    console.error('Google Play voided-purchases reconciliation failed', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'Voided-purchases reconciliation failed' }, { status: 502 });
  }
}