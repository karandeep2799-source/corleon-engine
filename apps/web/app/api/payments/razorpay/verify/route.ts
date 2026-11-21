import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedCheckoutPrincipal } from "@/lib/checkout-auth";
import { fetchRazorpayPayment, verifyCheckoutSignature } from "@/lib/razorpay";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

export async function POST(request: NextRequest) {
  if (process.env.PAYMENTS_ENABLED !== "true" || process.env.RAZORPAY_CHECKOUT_ENABLED !== "true") {
    return NextResponse.json({ error: "Payment verification is disabled." }, { status: 503, headers });
  }

  let body: { razorpay_order_id?: unknown; razorpay_payment_id?: unknown; razorpay_signature?: unknown };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400, headers });
  }
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = body;
  if (typeof orderId !== "string" || typeof paymentId !== "string" || typeof signature !== "string"
    || orderId.length > 128 || paymentId.length > 128 || signature.length > 256) {
    return NextResponse.json({ error: "Invalid Razorpay callback payload." }, { status: 400, headers });
  }

  const attempt = await prisma.paymentAttempt.findFirst({
    where: { razorpayOrderId: orderId, provider: "razorpay" },
  });
  if (!attempt) return NextResponse.json({ error: "Payment attempt not found." }, { status: 404, headers });
  const principal = await getAuthenticatedCheckoutPrincipal(request, attempt.orderReference, attempt.organizationId);
  if (!principal) return NextResponse.json({ error: "Authenticated customer session or customer access mapping is unavailable." }, { status: 403, headers });
  const order = await prisma.order.findFirst({
    where: { externalId: attempt.orderReference, organizationId: principal.organizationId, customerId: principal.customerId },
  });
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404, headers });
  if (!verifyCheckoutSignature(orderId, paymentId, signature)) {
    return NextResponse.json({ error: "Invalid payment signature." }, { status: 400, headers });
  }

  let payment;
  try { payment = await fetchRazorpayPayment(paymentId); } catch {
    return NextResponse.json({ error: "Could not verify payment status with Razorpay." }, { status: 502, headers });
  }
  if (payment.id !== paymentId || payment.order_id !== orderId || payment.amount !== attempt.amountMinor || payment.currency !== attempt.currency) {
    return NextResponse.json({ error: "Payment does not match the stored order." }, { status: 400, headers });
  }
  if (payment.status !== "captured") {
    return NextResponse.json({ status: payment.status === "authorized" ? "processing" : payment.status, verified: true }, { status: 202, headers });
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.paymentAttempt.updateMany({
      where: { id: attempt.id, status: { not: "SUCCEEDED" } },
      data: { status: "SUCCEEDED", razorpayPaymentId: paymentId, providerReference: paymentId },
    });
    if (updated.count > 0) {
      await tx.paymentAttemptEvent.create({
        data: { paymentAttemptId: attempt.id, eventType: "RAZORPAY_PAYMENT_CAPTURED", provider: "razorpay", details: { paymentId } },
      });
    }
    await tx.order.updateMany({
      where: { id: order.id, status: "PENDING" },
      data: { status: "PAID", provider: "razorpay", providerEventId: paymentId },
    });
  });
  return NextResponse.json({ verified: true, status: "captured", orderReference: order.externalId }, { headers });
}
