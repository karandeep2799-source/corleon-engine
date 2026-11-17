import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { generateKeyPairSync, sign } from "node:crypto";
import { verifyGoogleIdToken } from "./google-id-token";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const exported = publicKey.export({ format: "jwk" });
const kid = "corleon-google-test-key";
const jwk = { ...exported, kid, kty: "RSA", alg: "RS256", use: "sig" };
const originalClientId = process.env.GOOGLE_CLIENT_ID;

function makeToken(payload: Record<string, unknown>): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const header = encode({ alg: "RS256", kid, typ: "JWT" });
  const body = encode(payload);
  const input = header + "." + body;
  const signature = sign("RSA-SHA256", Buffer.from(input), privateKey).toString("base64url");
  return input + "." + signature;
}

beforeAll(() => {
  process.env.GOOGLE_CLIENT_ID = "corleon-test-client";
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ keys: [jwk] }), {
    status: 200,
    headers: { "cache-control": "public, max-age=300" },
  })));
});

afterAll(() => {
  if (originalClientId === undefined) delete process.env.GOOGLE_CLIENT_ID;
  else process.env.GOOGLE_CLIENT_ID = originalClientId;
  vi.unstubAllGlobals();
});

describe("Google Identity Services ID token verification", () => {
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: "https://accounts.google.com",
    aud: "corleon-test-client",
    exp: now + 3600,
    iat: now,
    sub: "google-subject-123",
    email: "verified@example.com",
    email_verified: true,
    nonce: "csrf-nonce-123",
  };

  it("accepts a correctly signed token with the expected audience and nonce", async () => {
    const result = await verifyGoogleIdToken(makeToken(claims), "csrf-nonce-123");
    expect(result).toMatchObject({ sub: claims.sub, email: claims.email, email_verified: true });
  });

  it("rejects a token with a different nonce or OAuth audience", async () => {
    await expect(verifyGoogleIdToken(makeToken(claims), "different-nonce")).rejects.toThrow(/nonce/);
    await expect(verifyGoogleIdToken(makeToken({ ...claims, aud: "untrusted-client" }), "csrf-nonce-123")).rejects.toThrow(/audience/);
  });

  it("rejects an expired token", async () => {
    await expect(verifyGoogleIdToken(makeToken({ ...claims, exp: now - 1 }), "csrf-nonce-123")).rejects.toThrow(/expired/);
  });
});
