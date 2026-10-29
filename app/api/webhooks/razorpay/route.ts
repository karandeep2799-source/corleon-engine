import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/razorpay";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

type RazorpayWebhook = {
  event?: string;
  payload?: {
    payment?: { entity?: { id?: string; order_id?: string; status?: string; amount?: number; currency?: string } };
    order?: { entity?: { id?: string; status?: string; amount?: number; currency?: string } };
  };
};

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  const eventId = request.headers.get("x-razorpay-event-id")?.trim();
  if (!eventId || eventId.length > 200 || !verifyWebhookSignature(rawBody, signature)) return NextResponse.json({ error: "Invalid webhook signature or event ID." }, { status: 400, headers });
  let event: RazorpayWebhook;
  try { event = JSON.parse(rawBody) as RazorpayWebhook; } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400, headers }); }
  if (!event.event || event.event.length > 128) return NextResponse.json({ error: "Invalid webhook event." }, { status: 400, headers });

  const payment = event.payload?.payment?.entity;
  const razorpayOrderId = payment?.order_id ?? event.payload?.order?.entity?.id;
  const attempt = razorpayOrderId ? await prisma.paymentAttempt.findUnique({ where: { razorpayOrderId } }) : null;
  const sanitizedPayload = {
    event: event.event,
    orderId: razorpayOrderId ?? null,
    paymentId: payment?.id ?? null,
    paymentStatus: payment?.status ?? null,
    amount: payment?.amount ?? event.payload?.order?.entity?.amount ?? null,
    currency: payment?.currency ?? event.payload?.order?.entity?.currency ?? null,
  };

  try {
    await prisma.razorpayWebhookEvent.create({ data: { eventId, eventType: event.event, organizationId: attempt?.organizationId ?? null, payload: sanitizedPayload } });
  } catch (error) {
    if (!(typeof error === "object" && error !== null && "code" in error && error.code === "P2002")) throw error;
    // A duplicate already processed event is acknowledged. If a previous run
    // crashed after persistence but before processing, retry the work.
    const prior = await prisma.razorpayWebhookEvent.findUnique({ where: { eventId } });
    if (prior?.processedAt) return NextResponse.json({ received: true, duplicate: true }, { headers });
  }

  if (attempt && event.event === "payment.captured" && payment?.id && payment.amount === attempt.amountMinor && payment.currency === attempt.currency) {
    await prisma.$transaction(async tx => {
      await tx.paymentAttempt.update({ where: { id: attempt.id }, data: { status: "SUCCEEDED", razorpayPaymentId: payment.id, providerReference: payment.id, events: { create: { eventType: "RAZORPAY_WEBHOOK_PAYMENT_CAPTURED", provider: "razorpay", requestId: eventId, details: { paymentId: payment.id } } } } });
      await tx.order.updateMany({ where: { organizationId: attempt.organizationId, externalId: attempt.orderReference, status: "PENDING" }, data: { status: "PAID", provider: "razorpay", providerEventId: payment.id } });
    });
  } else if (attempt && event.event === "payment.failed" && payment?.id) {
    await prisma.$transaction(async tx => {
      const updated = await tx.paymentAttempt.updateMany({
        where: { id: attempt.id, status: { not: "SUCCEEDED" } },
        data: { status: "FAILED", failureCode: "RAZORPAY_PAYMENT_FAILED" },
      });
      if (updated.count > 0) {
        await tx.paymentAttemptEvent.create({
          data: { paymentAttemptId: attempt.id, eventType: "RAZORPAY_WEBHOOK_PAYMENT_FAILED", provider: "razorpay", requestId: eventId, details: { paymentId: payment.id } },
        });
      }
    });
  }
  await prisma.razorpayWebhookEvent.update({ where: { eventId }, data: { processedAt: new Date() } });
  return NextResponse.json({ received: true }, { headers });
}
