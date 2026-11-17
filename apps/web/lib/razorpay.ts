import { createHmac, timingSafeEqual } from "node:crypto";

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

export function razorpayKeyId(): string {
  return requiredEnv("RAZORPAY_KEY_ID");
}

function razorpayKeySecret(): string {
  return requiredEnv("RAZORPAY_KEY_SECRET");
}

function razorpayWebhookSecret(): string {
  return requiredEnv("RAZORPAY_WEBHOOK_SECRET");
}

export function secureHexEqual(expected: string, actual: string): boolean {
  if (!/^[a-f0-9]+$/i.test(expected) || !/^[a-f0-9]+$/i.test(actual) || expected.length !== actual.length) return false;
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(actual, "hex"));
}

export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string): boolean {
  if (!orderId || !paymentId || !signature) return false;
  const expected = createHmac("sha256", razorpayKeySecret()).update(`${orderId}|${paymentId}`).digest("hex");
  return secureHexEqual(expected, signature);
}

export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  if (!rawBody || !signature) return false;
  const expected = createHmac("sha256", razorpayWebhookSecret()).update(rawBody, "utf8").digest("hex");
  return secureHexEqual(expected, signature);
}

export interface RazorpayOrderResponse {
  id: string;
  amount: number;
  currency: string;
  receipt?: string;
  status?: string;
}

export async function createRazorpayOrder(input: {
  amount: number;
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<RazorpayOrderResponse> {
  const credentials = Buffer.from(`${razorpayKeyId()}:${razorpayKeySecret()}`).toString("base64");
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/json" },
    body: JSON.stringify({ amount: input.amount, currency: input.currency, receipt: input.receipt, notes: input.notes ?? {} }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Razorpay order creation failed with HTTP ${response.status}`);
  const result = await response.json() as RazorpayOrderResponse;
  if (!result.id || result.amount !== input.amount || result.currency !== input.currency) {
    throw new Error("Razorpay returned an unexpected order response");
  }
  return result;
}

export async function fetchRazorpayPayment(paymentId: string): Promise<{
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
}> {
  const credentials = Buffer.from(`${razorpayKeyId()}:${razorpayKeySecret()}`).toString("base64");
  const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Basic ${credentials}` },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Razorpay payment lookup failed with HTTP ${response.status}`);
  return await response.json() as { id: string; order_id: string; amount: number; currency: string; status: string };
}
