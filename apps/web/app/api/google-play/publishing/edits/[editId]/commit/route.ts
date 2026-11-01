import { NextRequest, NextResponse } from 'next/server';
import { getGooglePlayConfig } from '../../../../../../../../../src/google-play/config.js';
import { googlePlay } from '../../../../../../../../../src/google-play/client.js';
import { isGooglePlayAdminRequest, isProductionPublishingApproved, isPublishingApproved } from '../../../../../../../../../src/google-play/security.js';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest, context: { params: Promise<{ editId: string }> }) {
  if (!isGooglePlayAdminRequest(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isPublishingApproved(request)) return NextResponse.json({ error: 'Publishing commit is disabled; explicit publishing approval and enablement are required' }, { status: 403 });
  const { packageName, serviceAccount } = getGooglePlayConfig();
  if (!packageName || !serviceAccount) return NextResponse.json({ error: 'Google Play integration is not configured' }, { status: 503 });
  try {
    const { editId } = await context.params;
    if (!editId || editId.length > 256) return NextResponse.json({ error: 'Invalid edit ID' }, { status: 400 });
    const body = await request.json() as { track?: string };
    if (!body.track || !['internal', 'alpha', 'beta', 'production'].includes(body.track)) return NextResponse.json({ error: 'A valid track is required for explicit commit approval' }, { status: 400 });
    if (body.track === 'production' && !isProductionPublishingApproved(request)) return NextResponse.json({ error: 'Production commit requires the separate production approval gate' }, { status: 403 });
    return NextResponse.json({ ok: true, committed: true, track: body.track, result: await googlePlay.commitEdit(packageName, editId) });
  } catch (error) {
    console.error('Google Play edit commit failed', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'Publishing edit commit failed' }, { status: 502 });
  }
}