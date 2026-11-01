import { NextRequest, NextResponse } from 'next/server';
import { getGooglePlayConfig } from '../../../../../../../src/google-play/config';
import { googlePlay } from '../../../../../../../src/google-play/client';
import { isGooglePlayAdminRequest } from '../../../../../../../src/google-play/security';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  if (!isGooglePlayAdminRequest(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const developerId = process.env.GOOGLE_PLAY_DEVELOPER_ACCOUNT_ID?.trim();
  if (!developerId) return NextResponse.json({ error: 'GOOGLE_PLAY_DEVELOPER_ACCOUNT_ID is required for account-level user permissions lookup' }, { status: 503 });
  if (!getGooglePlayConfig().serviceAccount) return NextResponse.json({ error: 'Google Play service-account credentials are not configured' }, { status: 503 });
  try { return NextResponse.json(await googlePlay.users(developerId, request.nextUrl.searchParams.get('pageToken') || undefined), { headers: { 'cache-control': 'no-store' } }); }
  catch (error) {
    console.error('Google Play permissions lookup failed', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'Permissions lookup failed' }, { status: 502 });
  }
}