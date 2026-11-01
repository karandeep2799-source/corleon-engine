import { NextRequest, NextResponse } from 'next/server';
import { getGooglePlayConfig } from '../../../../../../src/google-play/config';
import { googlePlay } from '../../../../../../src/google-play/client';
import { isGooglePlayAdminRequest, isSupportWriteApproved } from '../../../../../../src/google-play/security';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  if (!isGooglePlayAdminRequest(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { packageName, serviceAccount } = getGooglePlayConfig();
  if (!packageName || !serviceAccount) return NextResponse.json({ error: 'Google Play integration is not configured' }, { status: 503 });
  try {
    const result = await googlePlay.reviews(packageName, request.nextUrl.searchParams.get('pageToken') || undefined);
    return NextResponse.json(result, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    console.error('Google Play reviews lookup failed', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'Reviews lookup failed' }, { status: 502 });
  }
}
export async function POST(request: NextRequest) {
  if (!isGooglePlayAdminRequest(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isSupportWriteApproved(request)) return NextResponse.json({ error: 'Review replies are disabled; explicit support-write approval is required' }, { status: 403 });
  const { packageName, serviceAccount } = getGooglePlayConfig();
  if (!packageName || !serviceAccount) return NextResponse.json({ error: 'Google Play integration is not configured' }, { status: 503 });
  try {
    const body = await request.json() as { reviewId?: string; replyText?: string };
    if (!body.reviewId?.trim() || !body.replyText?.trim() || body.replyText.length > 350) return NextResponse.json({ error: 'reviewId and replyText (max 350 characters) are required' }, { status: 400 });
    const result = await googlePlay.replyToReview(packageName, body.reviewId, body.replyText);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error('Google Play review reply failed', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'Review reply failed' }, { status: 502 });
  }
}