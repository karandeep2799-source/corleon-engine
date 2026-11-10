import { NextRequest, NextResponse } from 'next/server';
import { authorizeBillingRequest, createCorleonInvoice } from '../../../../../../src/cashflow/stripe-billing.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!authorizeBillingRequest(token)) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  try {
    const body = await request.json();
    const result = await createCorleonInvoice(body);
    return NextResponse.json(result, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create invoice.';
    const status = /Invalid|must |Unknown|exceeds|belong/.test(message) ? 400 : 502;
    return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}
