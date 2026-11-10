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
    if (local.status !== 'OPEN') {
      return NextResponse.json({ error: 'Only finalized open invoices can be sent.' }, { status: 409 });
    }

    const invoice = await getStripe().invoices.sendInvoice(local.stripeInvoiceId, {}, {
      idempotencyKey: `corleon-send-${local.stripeInvoiceId}`,
    });
    const synced = await syncStripeInvoice(invoice);
    return NextResponse.json(
      { invoice: synced ? presentInvoiceRecord(synced) : null, hostedInvoiceUrl: invoice.hosted_invoice_url },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json({ error: 'Invoice delivery failed. Check invoice state and Stripe configuration.' }, { status: 502 });
  }
}
