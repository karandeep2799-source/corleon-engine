import { NextRequest, NextResponse } from 'next/server';
import { getGooglePlayConfig } from '../../../../../../../../../../src/google-play/config';
import { googlePlay } from '../../../../../../../../../../src/google-play/client';
import { isGooglePlayAdminRequest, isPublishingApproved } from '../../../../../../../../../../src/google-play/security';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function PUT(request: NextRequest, context: { params: Promise<{ editId: string; language: string }> }) {
  if (!isGooglePlayAdminRequest(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isPublishingApproved(request)) return NextResponse.json({ error: 'Store listing changes require explicit publishing approval' }, { status: 403 });
  const { packageName, serviceAccount } = getGooglePlayConfig();
  if (!packageName || !serviceAccount) return NextResponse.json({ error: 'Google Play integration is not configured' }, { status: 503 });
  try {
    const { editId, language } = await context.params;
    if (!editId || editId.length > 256 || !/^[a-z]{2,3}(-[A-Z]{2})?$/.test(language)) return NextResponse.json({ error: 'Invalid edit ID or language code' }, { status: 400 });
    const body = await request.json() as { title?: string; shortDescription?: string; fullDescription?: string; video?: string };
    if (body.title !== undefined && body.title.length > 50) return NextResponse.json({ error: 'title exceeds 50 characters' }, { status: 400 });
    if (body.shortDescription !== undefined && body.shortDescription.length > 80) return NextResponse.json({ error: 'shortDescription exceeds 80 characters' }, { status: 400 });
    if (body.fullDescription !== undefined && body.fullDescription.length > 4000) return NextResponse.json({ error: 'fullDescription exceeds 4000 characters' }, { status: 400 });
    return NextResponse.json({ ok: true, listing: await googlePlay.updateListing(packageName, editId, language, body) });
  } catch (error) {
    console.error('Google Play listing update failed', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'Store listing update failed' }, { status: 502 });
  }
}