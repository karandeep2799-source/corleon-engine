import { NextResponse } from 'next/server';
import { processRtdn } from '../../../../../../src/google-play/rtdn.js';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  try {
    const result = await processRtdn(request);
    return NextResponse.json(result.body, { status: result.status, headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    console.error('Google Play RTDN processing failed', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'Notification processing failed' }, { status: 502 });
  }
}