import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedCheckoutPrincipal } from "@/lib/checkout-auth";
import { createRazorpayOrder, razorpayKeyId } from "@/lib/razorpay";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

export async function POST(request: NextRequest) {
  const principal = await getAuthenticatedCheckoutPrincipal(request);
  if (!principal) return NextResponse.json({ error: "Checkout unavailable: authenticated customer session is not configured." }, { status: 503, headers });
  if (process.env.PAYMENTS_ENABLED !== "true" || process.env.RAZORPAY_CHECKOUT_ENABLED !== "true") {
    return NextResponse.json({ error: "Razorpay checkout is disabled by deployment configuration." }, { status: 503, headers });
  }
  const idempotencyKey = request.headers.get("idempotency-key")?.trim();
  if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 128 || !/^[a-zA-Z0-9._:-]+$/.test(idempotencyKey)) {
    return NextResponse.json({ error: "A valid Idempotency-Key header is required." }, { status: 400, headers });
  }
  let body: { orderReference?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400, headers }); }
  if (typeof body.orderReference !== "string" || body.orderReference.length < 1 || body.orderReference.length > 128) {
    return NextResponse.json({ error: "A valid orderReference is required." }, { status: 400, headers });
  }

  const order = await prisma.order.findFirst({
    where: { externalId: body.orderReference, organizationId: principal.organizationId, customerId: principal.customerId, status: "PENDING" },
    include: { customer: true },
  });
  if (!order) return NextResponse.json({ error: "Order not found or not payable." }, { status: 404, headers });
  if (order.currency.toUpperCase() !== "INR") return NextResponse.json({ error: "Razorpay Google Pay UPI checkout is currently configured for INR orders only." }, { status: 422, headers });
  const amount = Number(order.amount.toString());
  const amountMinor = Math.round(amount * 100);
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0 || Math.abs(amount * 100 - amountMinor) > 0.000001) {
    return NextResponse.json({ error: "Order amount must be a positive INR amount with at most two decimal places." }, { status: 422, headers });
  }

  let attempt = await prisma.paymentAttempt.findUnique({ where: { organizationId_idempotencyKey: { organizationId: principal.organizationId, idempotencyKey } } });
  if (attempt) {
    if (attempt.orderReference !== order.externalId || attempt.amountMinor !== amountMinor || attempt.currency !== "INR") return NextResponse.json({ error: "Idempotency key was already used for a different order." }, { status: 409, headers });
    if (attempt.razorpayOrderId) return NextResponse.json({ keyId: razorpayKeyId(), orderId: attempt.razorpayOrderId, amount: attempt.amountMinor, currency: attempt.currency, attemptId: attempt.id }, { headers });
    return NextResponse.json({ error: "An attempt with this idempotency key is being reconciled. Use a new key only after checking payment status." }, { status: 409, headers });
  }

  attempt = await prisma.paymentAttempt.create({
    data: { organizationId: principal.organizationId, orderReference: order.externalId, idempotencyKey, amountMinor, currency: "INR", status: "CREATED", provider: "razorpay", events: { create: { eventType: "RAZORPAY_ORDER_REQUESTED", provider: "razorpay" } } },
  });
  try {
    const remoteOrder = await createRazorpayOrder({ amount: amountMinor, currency: "INR", receipt: attempt.id, notes: { corleonAttemptId: attempt.id, corleonOrderReference: order.externalId } });
    await prisma.paymentAttempt.update({ where: { id: attempt.id }, data: { razorpayOrderId: remoteOrder.id, status: "PROCESSING", events: { create: { eventType: "RAZORPAY_ORDER_CREATED", provider: "razorpay", details: { razorpayOrderId: remoteOrder.id } } } } });
    return NextResponse.json({ keyId: razorpayKeyId(), orderId: remoteOrder.id, amount: remoteOrder.amount, currency: remoteOrder.currency, attemptId: attempt.id, name: "Corleon Engine", description: "Order payment", prefill: { email: order.customer.email ?? undefined, name: order.customer.name ?? undefined } }, { headers });
  } catch {
    await prisma.paymentAttempt.update({ where: { id: attempt.id }, data: { status: "FAILED", failureCode: "RAZORPAY_ORDER_CREATE_FAILED", events: { create: { eventType: "RAZORPAY_ORDER_CREATE_FAILED", provider: "razorpay" } } } });
    return NextResponse.json({ error: "Unable to initialize payment. Please retry with a new idempotency key after checking order status." }, { status: 502, headers });
  }
}
