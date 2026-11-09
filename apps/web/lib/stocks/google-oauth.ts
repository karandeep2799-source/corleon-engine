import { createHash, randomBytes } from "node:crypto";

export const GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO = "https://openidconnect.googleapis.com/v1/userinfo";

function config() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Configure GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET and GOOGLE_OAUTH_REDIRECT_URI.");
  }
  return { clientId, clientSecret, redirectUri };
}
export function createOAuthState() {
  return randomBytes(24).toString("base64url");
}
export function createPkceVerifier() {
  return randomBytes(48).toString("base64url");
}
export function createPkceChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}
export function buildGoogleAuthorizationUrl(state: string, verifier: string) {
  const { clientId, redirectUri } = config();
  const url = new URL(GOOGLE_AUTH);
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: `openid email profile ${GMAIL_READONLY_SCOPE}`,
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    state,
    code_challenge: createPkceChallenge(verifier),
    code_challenge_method: "S256",
  }).toString();
  return url;
}
export async function exchangeGoogleCode(code: string, verifier: string) {
  const { clientId, clientSecret, redirectUri } = config();
  const response = await fetch(GOOGLE_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri,
      grant_type: "authorization_code", code_verifier: verifier,
    }),
    cache: "no-store",
  });
  const data = await response.json() as { access_token?: string; refresh_token?: string; scope?: string; expires_in?: number; error?: string };
  if (!response.ok || !data.access_token) throw new Error(data.error || "Google authorization-code exchange failed.");
  return data;
}
export async function getGoogleProfile(accessToken: string) {
  const response = await fetch(GOOGLE_USERINFO, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const data = await response.json() as { email?: string; email_verified?: boolean; name?: string; picture?: string };
  if (!response.ok || !data.email || data.email_verified !== true) throw new Error("Google did not return a verified email address.");
  return data;
}
export function secureCookieOptions(maxAge: number) {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/api/stocks/auth/callback", maxAge };
}
