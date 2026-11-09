import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { bitcoinPrisma } from "@/lib/bitcoin/prisma";
import { exchangeGoogleCode, getGoogleProfile } from "@/lib/stocks/google-oauth";
import { createStockSessionToken, encryptRefreshToken } from "@/lib/stocks/session";

export const runtime = "nodejs";

function matches(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
function redirectWithError(request: NextRequest, reason: string) {
  const response = NextResponse.redirect(new URL(`/stocks?error=${encodeURIComponent(reason)}`, request.url));
  response.cookies.delete("corleon_stocks_oauth_state");
  response.cookies.delete("corleon_stocks_pkce");
  return response;
}
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get("corleon_stocks_oauth_state")?.value;
  const verifier = request.cookies.get("corleon_stocks_pkce")?.value;
  if (request.nextUrl.searchParams.has("error")) return redirectWithError(request, "google_consent_declined");
  if (!code || !state || !expectedState || !verifier || !matches(state, expectedState)) return redirectWithError(request, "oauth_state_invalid");

  try {
    const token = await exchangeGoogleCode(code, verifier);
    const profile = await getGoogleProfile(token.access_token!);
    const email = profile.email!.toLowerCase();
    const existing = await bitcoinPrisma.gmailConnection.findUnique({ where: { email } });
    const refreshToken = token.refresh_token ? encryptRefreshToken(token.refresh_token) : existing?.refreshTokenEncrypted;
    if (!refreshToken) return redirectWithError(request, "google_refresh_token_missing");
    const requiredScope = "https://www.googleapis.com/auth/gmail.readonly";
    const grantedScopes = (token.scope || "").split(" ").filter(Boolean);
    if (!grantedScopes.includes(requiredScope) && !existing?.grantedScopes.includes(requiredScope)) {
      return redirectWithError(request, "gmail_readonly_scope_missing");
    }
    await bitcoinPrisma.gmailConnection.upsert({
      where: { email },
      create: {
        email,
        displayName: profile.name?.slice(0, 120),
        picture: profile.picture?.slice(0, 500),
        refreshTokenEncrypted: refreshToken,
        grantedScopes: grantedScopes.length ? grantedScopes : [requiredScope],
      },
      update: {
        displayName: profile.name?.slice(0, 120),
        picture: profile.picture?.slice(0, 500),
        refreshTokenEncrypted: refreshToken,
        grantedScopes: grantedScopes.length ? grantedScopes : existing?.grantedScopes ?? [requiredScope],
      },
    });
    const sessionToken = createStockSessionToken({ email, name: profile.name, picture: profile.picture });
    const response = NextResponse.redirect(new URL("/stocks?connected=1", request.url));
    response.cookies.set("corleon_stocks_session", sessionToken, {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 8,
    });
    response.cookies.delete("corleon_stocks_oauth_state");
    response.cookies.delete("corleon_stocks_pkce");
    return response;
  } catch (error) {
    console.error("Stock Intelligence Google callback failed", error);
    return redirectWithError(request, "google_connection_failed");
  }
}
