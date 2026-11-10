import type Stripe from 'stripe';
import { StripeInvoiceStatus } from '@prisma/client';
import { prisma } from '../prisma';
import { getStripe } from './stripe';

export function mapStripeInvoiceStatus(status: Stripe.Invoice.Status | null | undefined): StripeInvoiceStatus {
  switch (status) {
    case 'open': return StripeInvoiceStatus.OPEN;
    case 'paid': return StripeInvoiceStatus.PAID;
    case 'void': return StripeInvoiceStatus.VOID;
    case 'uncollectible': return StripeInvoiceStatus.UNCOLLECTIBLE;
    default: return StripeInvoiceStatus.DRAFT;
  }
}

export async function syncStripeInvoice(invoice: Stripe.Invoice) {
  const organizationId = invoice.metadata?.corleonOrganizationId;
  const customerId = invoice.metadata?.corleonCustomerId;
  if (!organizationId || !customerId) return null;

  return prisma.stripeInvoice.upsert({
    where: { stripeInvoiceId: invoice.id },
    create: {
      organizationId,
      customerId,
      stripeInvoiceId: invoice.id,
      number: invoice.number,
      status: mapStripeInvoiceStatus(invoice.status),
      currency: invoice.currency,
      subtotal: BigInt(invoice.subtotal),
      total: BigInt(invoice.total),
      amountDue: BigInt(invoice.amount_due),
      amountPaid: BigInt(invoice.amount_paid),
      hostedInvoiceUrl: invoice.hosted_invoice_url,
      invoicePdf: invoice.invoice_pdf,
      dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : null,
      finalizedAt: invoice.status_transitions.finalized_at ? new Date(invoice.status_transitions.finalized_at * 1000) : null,
      paidAt: invoice.status_transitions.paid_at ? new Date(invoice.status_transitions.paid_at * 1000) : null,
    },
    update: {
      number: invoice.number,
      status: mapStripeInvoiceStatus(invoice.status),
      subtotal: BigInt(invoice.subtotal),
      total: BigInt(invoice.total),
      amountDue: BigInt(invoice.amount_due),
      amountPaid: BigInt(invoice.amount_paid),
      hostedInvoiceUrl: invoice.hosted_invoice_url,
      invoicePdf: invoice.invoice_pdf,
      dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : null,
      finalizedAt: invoice.status_transitions.finalized_at ? new Date(invoice.status_transitions.finalized_at * 1000) : null,
      paidAt: invoice.status_transitions.paid_at ? new Date(invoice.status_transitions.paid_at * 1000) : null,
    },
  });
}

export async function createInvoice(input: {
  organizationId: string;
  customerId: string;
  description?: string;
  dueDays?: number;
  items: Array<{ description: string; amount: number }>;
  idempotencyKey: string;
}) {
  const stripe = getStripe();
  const customer = await prisma.customer.findFirst({
    where: { id: input.customerId, organizationId: input.organizationId },
    include: { organization: true },
  });
  if (!customer) throw new Error('Customer not found in the specified organization.');
  if (!customer.email) throw new Error('Customer email is required for invoice delivery.');

  let stripeCustomerId = customer.stripeCustomerId;
  if (!stripeCustomerId) {
    const created = await stripe.customers.create({
      email: customer.email,
      name: customer.name ?? undefined,
      metadata: { organizationId: input.organizationId, customerId: customer.id, customerEmail: customer.email, corleonOrganizationId: input.organizationId, corleonCustomerId: customer.id },
    }, { idempotencyKey: `corleon-customer-${customer.id}` });
    stripeCustomerId = created.id;
    await prisma.customer.update({ where: { id: customer.id }, data: { stripeCustomerId } });
  }

  const currency = 'inr';
  const invoice = await stripe.invoices.create({
    customer: stripeCustomerId,
    currency,
    collection_method: 'send_invoice',
    days_until_due: input.dueDays ?? 7,
    auto_advance: false,
    description: input.description,
    metadata: {
      organizationId: input.organizationId,
      customerId: customer.id,
      customerEmail: customer.email,
      corleonOrganizationId: input.organizationId,
      corleonCustomerId: customer.id,
      corleonSource: 'corleon-engine',
    },
  }, { idempotencyKey: `corleon-invoice-${input.idempotencyKey}` });

  for (const item of input.items) {
    await stripe.invoiceItems.create({
      customer: stripeCustomerId,
      invoice: invoice.id,
      currency,
      amount: item.amount,
      description: item.description,
    }, { idempotencyKey: `corleon-item-${invoice.id}-${input.items.indexOf(item)}` });
  }

  const refreshed = await stripe.invoices.retrieve(invoice.id);
  await syncStripeInvoice(refreshed);
  return refreshed;
}
