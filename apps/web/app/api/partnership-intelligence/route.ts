import { NextResponse } from "next/server";
import { partnershipDemoData } from "../../../lib/partnership-intelligence/demo-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ ...partnershipDemoData, generatedAt: new Date().toISOString() }, {
    status: 200,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer"
    }
  });
}
