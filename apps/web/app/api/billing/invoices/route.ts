import { NextRequest, NextResponse } from 'next/server';
import { authorizeBillingRequest } from '../../../../lib/billing/auth';
import { createInvoice } from '../../../../lib/billing/invoices';
import { prisma } from '../../../../lib/prisma';
import { presentInvoiceRecord, presentStripeInvoice } from '../../../../lib/billing/presentation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const denied = authorizeBillingRequest(request);
  if (denied) return denied;
  try {
    const body = await request.json();
    if (typeof body.organizationId !== 'string' || typeof body.customerId !== 'string' ||
        !Array.isArray(body.items) || body.items.length < 1 || body.items.length > 50) {
      return NextResponse.json({ error: 'organizationId, customerId and 1–50 invoice items are required.' }, { status: 400 });
    }
    const items = body.items.map((item: unknown) => {
      const value = item as { description?: unknown; amount?: unknown };
      if (typeof value.description !== 'string' || !value.description.trim() ||
          typeof value.amount !== 'number' || !Number.isFinite(value.amount) || value.amount <= 0 || !/^\\d+(?:\\.\\d{1,2})?$/.test(String(value.amount))) {
        throw new Error('Each item requires a description and a positive INR amount with up to 2 decimal places.');
      }
      return { description: value.description.trim().slice(0, 500), amount: Math.round((value.amount as number) * 100) };
    });
    const invoice = await createInvoice({
      organizationId: body.organizationId,
      customerId: body.customerId,
      description: typeof body.description === 'string' ? body.description.slice(0, 500) : undefined,
      dueDays: Number.isInteger(body.dueDays) && body.dueDays >= 1 && body.dueDays <= 30 ? body.dueDays : 7,
      items,
    });
    return NextResponse.json({ invoice: presentStripeInvoice(invoice) }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invoice creation failed.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET(request: NextRequest) {
  const denied = authorizeBillingRequest(request);
  if (denied) return denied;
  const organizationId = request.nextUrl.searchParams.get('organizationId');
  const customerId = request.nextUrl.searchParams.get('customerId');
  if (!organizationId) return NextResponse.json({ error: 'organizationId is required.' }, { status: 400 });
  const invoices = await prisma.stripeInvoice.findMany({
    where: { organizationId, ...(customerId ? { customerId } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return NextResponse.json({ invoices: invoices.map(presentInvoiceRecord) }, { headers: { 'Cache-Control': 'no-store' } });
}
