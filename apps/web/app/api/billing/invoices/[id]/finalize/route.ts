import { NextRequest, NextResponse } from 'next/server';
import { authorizeBillingRequest } from '../../../../../../lib/billing/auth';
import { syncStripeInvoice } from '../../../../../../lib/billing/invoices';
import { getStripe } from '../../../../../../lib/billing/stripe';
import { prisma } from '../../../../../../lib/prisma';
import { presentInvoiceRecord } from '../../../../../../lib/billing/presentation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const denied = authorizeBillingRequest(request);
  if (denied) return denied;
  try {
    const { id } = await context.params;
    const local = await prisma.stripeInvoice.findUnique({ where: { id } });
    if (!local) return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 });
    if (local.status !== 'DRAFT') return NextResponse.json({ error: 'Only draft invoices can be finalized.' }, { status: 409 });
    const invoice = await getStripe().invoices.finalizeInvoice(local.stripeInvoiceId, {}, {
      idempotencyKey: `corleon-finalize-${local.stripeInvoiceId}`,
    });
    const synced = await syncStripeInvoice(invoice);
    return NextResponse.json({ invoice: synced ? presentInvoiceRecord(synced) : null }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Invoice finalization failed.' }, { status: 400 });
  }
}
