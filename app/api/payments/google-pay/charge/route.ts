import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(_request: NextRequest) {
  // Fail closed: the repository currently has no verified session/auth adapter
  // or selected PSP-specific Google Pay token processor.
  return NextResponse.json({ error: "Checkout is disabled until authenticated order ownership and a processor-specific Google Pay adapter are configured." }, { status: 503, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
