import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST() {
  return NextResponse.json({
    error: "Direct Google Pay token charging is not supported by this Razorpay integration. Create a Razorpay order and use Razorpay Standard Checkout.",
    checkoutEndpoint: "/api/payments/razorpay/orders",
  }, { status: 410, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
