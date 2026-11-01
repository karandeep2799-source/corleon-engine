import { NextRequest, NextResponse } from 'next/server';
import { getGooglePlayConfig } from '../../../../../../../src/google-play/config';
import { googlePlay } from '../../../../../../../src/google-play/client';
import { isGooglePlayAdminRequest, isPublishingApproved } from '../../../../../../../src/google-play/security';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Creating a remote Play edit is disabled unless both gates are explicitly enabled.
export async function POST(request: NextRequest) {
  if (!isGooglePlayAdminRequest(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isPublishingApproved(request)) return NextResponse.json({ error: 'Publishing API is disabled; explicit publishing approval and enablement are required' }, { status: 403 });
  const { packageName, serviceAccount } = getGooglePlayConfig();
  if (!packageName || !serviceAccount) return NextResponse.json({ error: 'Google Play integration is not configured' }, { status: 503 });
  try { return NextResponse.json({ ok: true, edit: await googlePlay.createEdit(packageName) }, { status: 201 }); }
  catch (error) {
    console.error('Google Play edit creation failed', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'Could not create publishing edit' }, { status: 502 });
  }
}