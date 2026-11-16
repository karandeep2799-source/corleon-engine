import type Stripe from 'stripe';

const toRupees = (minor: bigint | number | null | undefined): number =>
  Number(minor ?? 0) / 100;

export function presentInvoiceRecord<T extends {
  subtotal: bigint | number;
  total: bigint | number;
  amountDue: bigint | number;
  amountPaid: bigint | number;
  currency: string;
}>(invoice: T) {
  return {
    ...invoice,
    subtotal: toRupees(invoice.subtotal),
    total: toRupees(invoice.total),
    amountDue: toRupees(invoice.amountDue),
    amountPaid: toRupees(invoice.amountPaid),
    currency: invoice.currency.toUpperCase(),
    currencySymbol: '₹',
  };
}

export function presentStripeInvoice(invoice: Stripe.Invoice) {
  return {
    id: invoice.id,
    number: invoice.number,
    status: invoice.status,
    currency: invoice.currency.toUpperCase(),
    currencySymbol: '₹',
    subtotal: toRupees(invoice.subtotal),
    total: toRupees(invoice.total),
    amountDue: toRupees(invoice.amount_due),
    amountPaid: toRupees(invoice.amount_paid),
    hostedInvoiceUrl: invoice.hosted_invoice_url,
    invoicePdf: invoice.invoice_pdf,
    dueDate: invoice.due_date ? new Date(invoice.due_date * 1000).toISOString() : null,
    finalizedAt: invoice.status_transitions.finalized_at ? new Date(invoice.status_transitions.finalized_at * 1000).toISOString() : null,
    paidAt: invoice.status_transitions.paid_at ? new Date(invoice.status_transitions.paid_at * 1000).toISOString() : null,
  };
}
