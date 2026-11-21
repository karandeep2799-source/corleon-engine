import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Google Pay is offered as a UPI payment method by Razorpay Standard Checkout
// where the merchant account and transaction are eligible.
export async function GET() {
  const enabled = process.env.PAYMENTS_ENABLED === "true" && process.env.RAZORPAY_CHECKOUT_ENABLED === "true";
  const keyId = enabled ? process.env.RAZORPAY_KEY_ID?.trim() : undefined;
  return NextResponse.json({
    provider: "razorpay",
    checkoutEnabled: enabled && Boolean(keyId),
    checkoutScriptUrl: "https://checkout.razorpay.com/v1/checkout.js",
    googlePayAvailability: "Razorpay Standard Checkout UPI option, subject to merchant eligibility",
    keyId: enabled ? keyId ?? null : null,
    currency: "INR",
  }, { headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
