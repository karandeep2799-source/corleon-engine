import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  fetchZoneAnalytics,
  parseAnalyticsRange,
} from '../../../../../lib/cloudflare/analytics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isAuthorized(request: NextRequest): boolean {
  const expectedSecret = process.env.CORLEON_CLOUDFLARE_ANALYTICS_KEY;
  const authorization = request.headers.get('authorization');

  if (!expectedSecret || !authorization) return false;

  const expected = Buffer.from(`Bearer ${expectedSecret}`, 'utf8');
  const actual = Buffer.from(authorization, 'utf8');

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function GET(request: NextRequest) {
  if (!process.env.CORLEON_CLOUDFLARE_ANALYTICS_KEY) {
    return NextResponse.json(
      { error: 'Cloudflare analytics endpoint is not enabled' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  if (!process.env.CLOUDFLARE_API_TOKEN || !process.env.CLOUDFLARE_ZONE_ID) {
    return NextResponse.json(
      { error: 'Cloudflare analytics is not configured' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const range = parseAnalyticsRange(request.nextUrl.searchParams.get('range'));

  try {
    const analytics = await fetchZoneAnalytics(range);
    return NextResponse.json(
      { ok: true, data: analytics },
      { status: 200, headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
    );
  } catch (error) {
    // Keep upstream response bodies, credentials, and provider details out of the API response.
    console.error('Cloudflare zone analytics query failed', {
      message: error instanceof Error ? error.message : 'Unknown provider error',
      code:
        error instanceof Error && 'code' in error
          ? String((error as Error & { code?: unknown }).code ?? '')
          : undefined,
    });

    const message = error instanceof Error ? error.message : '';
    const status = message.includes('not configured') ? 503 : 502;
    return NextResponse.json(
      { error: status === 503 ? 'Cloudflare analytics is not configured' : 'Analytics provider unavailable' },
      { status, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
