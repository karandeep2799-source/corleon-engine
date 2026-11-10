export interface CorleonCheckoutInput {
  organizationId: string;
  customerRef: string;
  customerEmail: string;
  customerName?: string;
  productKey: string;
  priceId: string;
  mode: 'payment' | 'subscription';
  successUrl: string;
  cancelUrl: string;
  idempotencyKey: string;
}
export interface CorleonInvoiceInput {
  organizationId: string;
  customerId: string;
  idempotencyKey: string;
  lineItems: Array<{ amountPaise: number; description: string }>;
  daysUntilDue?: number;
}
export interface CorleonPortalInput {
  organizationId: string;
  customerId: string;
  returnUrl: string;
}
export function authorizeBillingRequest(token: string | undefined): boolean;
export function createCorleonCheckout(input: CorleonCheckoutInput): Promise<{
  sessionId: string;
  checkoutUrl: string;
  customerId: string;
  mode: 'payment' | 'subscription';
  currency: 'INR';
}>;
export function createCorleonPortalSession(input: CorleonPortalInput): Promise<{ url: string; expiresAt: number }>;
export function createCorleonInvoice(input: CorleonInvoiceInput): Promise<{
  invoiceId: string;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
  amountDue: number;
  currency: string;
}>;
