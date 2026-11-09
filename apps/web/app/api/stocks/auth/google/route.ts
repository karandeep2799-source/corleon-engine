import { NextResponse } from "next/server";
import { buildGoogleAuthorizationUrl, createOAuthState, createPkceVerifier, secureCookieOptions } from "@/lib/stocks/google-oauth";

export const runtime = "nodejs";

export async function GET() {
  try {
    const state = createOAuthState();
    const verifier = createPkceVerifier();
    const response = NextResponse.redirect(buildGoogleAuthorizationUrl(state, verifier));
    response.cookies.set("corleon_stocks_oauth_state", state, secureCookieOptions(600));
    response.cookies.set("corleon_stocks_pkce", verifier, secureCookieOptions(600));
    return response;
  } catch (error) {
    console.error("Stock Intelligence OAuth configuration error", error);
    return NextResponse.json({ error: "Google Gmail connection is not configured yet." }, { status: 503 });
  }
}
