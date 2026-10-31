import { createHmac, timingSafeEqual } from 'node:crypto';

function credentials() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) throw new Error('Razorpay is not configured.');
  return { keyId, keySecret };
}

function authHeader(keyId: string, keySecret: string) {
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`;
}

export async function createRazorpayOrder(input: {
  amount: number; currency: 'INR'; receipt: string; notes: Record<string, string>;
}) {
  const { keyId, keySecret } = credentials();
  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: authHeader(keyId, keySecret),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(12_000),
    cache: 'no-store',
  });
  const data = await response.json() as { id?: string; amount?: number; currency?: string; status?: string; error?: { description?: string } };
  if (!response.ok || !data.id || data.amount !== input.amount || data.currency !== input.currency) {
    throw new Error(data.error?.description || 'Razorpay order creation failed.');
  }
  return { id: data.id, amount: data.amount, currency: data.currency, keyId };
}

export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string): boolean {
  const { keySecret } = credentials();
  const expected = createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest();
  const actual = Buffer.from(signature, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) throw new Error('Razorpay webhook secret is not configured.');
  const expected = createHmac('sha256', secret).update(rawBody).digest();
  const actual = Buffer.from(signature, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function fetchRazorpayPayment(paymentId: string) {
  const { keyId, keySecret } = credentials();
  const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: authHeader(keyId, keySecret) },
    signal: AbortSignal.timeout(12_000),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('Unable to verify payment with Razorpay.');
  return await response.json() as {
    id: string; order_id: string; amount: number; currency: string;
    status: 'created' | 'authorized' | 'captured' | 'refunded' | 'failed';
  };
}
