import { NextRequest, NextResponse } from 'next/server';
import { authorizeBillingRequest, createCorleonCheckout } from '../../../../../../src/cashflow/stripe-billing.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 20;

export async function POST(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!authorizeBillingRequest(token)) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  try {
    const body = await request.json();
    const result = await createCorleonCheckout(body);
    return NextResponse.json(result, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create checkout.';
    const status = /Invalid|must |Unknown|does not match|allowlisted|disabled|belong/.test(message) ? 400 : 502;
    return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}
