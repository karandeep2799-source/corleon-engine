import { NextRequest, NextResponse } from 'next/server';
import { authorizeBillingRequest, createCorleonPortalSession } from '../../../../../../src/cashflow/stripe-billing.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 15;

export async function POST(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!authorizeBillingRequest(token)) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  try {
    const body = await request.json();
    const result = await createCorleonPortalSession(body);
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create billing portal session.';
    const status = /Invalid|Unknown|allowlisted|belong/.test(message) ? 400 : 502;
    return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}
