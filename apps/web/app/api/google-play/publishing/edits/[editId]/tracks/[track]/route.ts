import { NextRequest, NextResponse } from 'next/server';
import { getGooglePlayConfig } from '../../../../../../../../../../src/google-play/config.js';
import { googlePlay } from '../../../../../../../../../../src/google-play/client.js';
import { isGooglePlayAdminRequest, isProductionPublishingApproved, isPublishingApproved } from '../../../../../../../../../../src/google-play/security.js';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const TRACKS = new Set(['internal', 'alpha', 'beta', 'production']);
export async function PUT(request: NextRequest, context: { params: Promise<{ editId: string; track: string }> }) {
  if (!isGooglePlayAdminRequest(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isPublishingApproved(request)) return NextResponse.json({ error: 'Track changes require explicit publishing approval' }, { status: 403 });
  const { packageName, serviceAccount } = getGooglePlayConfig();
  if (!packageName || !serviceAccount) return NextResponse.json({ error: 'Google Play integration is not configured' }, { status: 503 });
  try {
    const { editId, track } = await context.params;
    if (!editId || editId.length > 256 || !TRACKS.has(track)) return NextResponse.json({ error: 'Invalid edit ID or track' }, { status: 400 });
    if (track === 'production' && !isProductionPublishingApproved(request)) return NextResponse.json({ error: 'Production track changes require the separate production approval gate' }, { status: 403 });
    const body = await request.json() as Record<string, unknown>;
    if (!Array.isArray(body.releases)) return NextResponse.json({ error: 'releases must be an array' }, { status: 400 });
    return NextResponse.json({ ok: true, track: await googlePlay.updateTrack(packageName, editId, track, { ...body, track }) });
  } catch (error) {
    console.error('Google Play track update failed', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'Track update failed' }, { status: 502 });
  }
}