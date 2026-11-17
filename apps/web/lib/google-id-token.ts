import { createPublicKey, verify as verifySignature } from "node:crypto";

interface GoogleJwk extends JsonWebKey {
  kid: string;
  kty: string;
  alg?: string;
  use?: string;
}

interface GoogleIdTokenClaims {
  iss: string;
  aud: string | string[];
  azp?: string;
  exp: number;
  iat: number;
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  nonce?: string;
}

let jwksCache: { keys: GoogleJwk[]; expiresAt: number } | undefined;

async function googleSigningKeys(): Promise<GoogleJwk[]> {
  if (jwksCache && jwksCache.expiresAt > Date.now()) return jwksCache.keys;

  const response = await fetch("https://www.googleapis.com/oauth2/v3/certs", {
    cache: "no-store",
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error("Google signing keys are temporarily unavailable.");

  const body = await response.json() as { keys?: GoogleJwk[] };
  if (!Array.isArray(body.keys) || body.keys.length === 0) throw new Error("Google returned an invalid signing-key set.");

  const cacheControl = response.headers.get("cache-control") ?? "";
  const maxAgeMatch = /max-age=(\d+)/i.exec(cacheControl);
  const maxAgeSeconds = Math.min(Number(maxAgeMatch?.[1] ?? 300), 21_600);
  jwksCache = { keys: body.keys, expiresAt: Date.now() + maxAgeSeconds * 1000 };
  return body.keys;
}

function decodeJson(segment: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as Record<string, unknown>;
}

/**
 * Verify Google's RS256 ID token using Google's published JWK set. Enforces
 * issuer, audience, authorized party, expiry, issued-at, verified email and
 * the one-time nonce bound to the server-issued CSRF cookie.
 */
export async function verifyGoogleIdToken(
  token: string,
  expectedNonce: string,
): Promise<GoogleIdTokenClaims> {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!clientId) throw new Error("GOOGLE_CLIENT_ID is not configured.");
  if (token.length > 12_000) throw new Error("Google credential is too large.");

  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Malformed Google ID token.");

  const header = decodeJson(parts[0]);
  const claims = decodeJson(parts[1]) as unknown as GoogleIdTokenClaims;
  if (header.alg !== "RS256" || typeof header.kid !== "string") throw new Error("Unsupported Google ID token signature.");

  const keys = await googleSigningKeys();
  const jwk = keys.find((key) => key.kid === header.kid && key.kty === "RSA" && (!key.alg || key.alg === "RS256"));
  if (!jwk) {
    jwksCache = undefined;
    throw new Error("Google signing key was not found.");
  }

  const publicKey = createPublicKey({ key: jwk, format: "jwk" });
  const signingInput = Buffer.from(parts[0] + "." + parts[1], "utf8");
  const signature = Buffer.from(parts[2], "base64url");
  if (!verifySignature("RSA-SHA256", signingInput, publicKey, signature)) {
    throw new Error("Google ID token signature is invalid.");
  }

  const now = Math.floor(Date.now() / 1000);
  const audienceMatches = Array.isArray(claims.aud) ? claims.aud.includes(clientId) : claims.aud === clientId;
  const issuerMatches = claims.iss === "https://accounts.google.com" || claims.iss === "accounts.google.com";
  if (!issuerMatches || !audienceMatches || (claims.azp && claims.azp !== clientId)) throw new Error("Google ID token issuer or audience is invalid.");
  if (!Number.isFinite(claims.exp) || claims.exp <= now || !Number.isFinite(claims.iat) || claims.iat > now + 60 || claims.exp - claims.iat > 3_660) {
    throw new Error("Google ID token is expired or has invalid timestamps.");
  }
  if (claims.nonce !== expectedNonce) throw new Error("Google ID token nonce does not match this sign-in request.");
  if (typeof claims.sub !== "string" || claims.sub.length < 1 || claims.sub.length > 255) throw new Error("Google subject is invalid.");
  if (typeof claims.email !== "string" || claims.email.length > 320 || claims.email_verified !== true) throw new Error("Google email is not verified.");

  return { ...claims, email: claims.email.trim().toLowerCase() };
}
