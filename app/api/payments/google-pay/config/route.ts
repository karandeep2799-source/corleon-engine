import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// This endpoint describes Razorpay Standard Checkout. Google Pay is surfaced
// by Razorpay as an available UPI option where enabled for the merchant.
export async function GET() {
  const enabled = process.env.PAYMENTS_ENABLED === "true" && process.env.RAZORPAY_CHECKOUT_ENABLED === "true";
  const keyId = enabled ? process.env.RAZORPAY_KEY_ID?.trim() : undefined;
  return NextResponse.json({
    provider: "razorpay",
    checkoutEnabled: enabled && Boolean(keyId),
    checkoutScriptUrl: "https://checkout.razorpay.com/v1/checkout.js",
    googlePayAvailability: "Provided by Razorpay Checkout under UPI when enabled for the merchant account",
    keyId: enabled ? keyId ?? null : null,
    currency: "INR",
  }, { headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
