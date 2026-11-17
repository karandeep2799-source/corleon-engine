import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const csrfToken = randomBytes(32).toString("base64url");
  const response = NextResponse.json({ csrfToken }, {
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
  response.cookies.set("__Host-corleon-csrf", csrfToken, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 300,
  });
  return response;
}
