import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

export type SandboxAuthResult =
  | { ok: true; tenantId: string; requestId: string }
  | { ok: false; status: 401 | 503; error: string; requestId: string };

export function getRequestId(request: NextRequest): string {
  const candidate = request.headers.get("x-request-id");
  if (candidate && /^[a-zA-Z0-9._:-]{1,100}$/.test(candidate)) return candidate;
  return randomUUID();
}

export function authorizeSandboxRequest(request: NextRequest): SandboxAuthResult {
  const requestId = getRequestId(request);
  const secret = process.env.CORLEON_SANDBOX_API_KEY;
  const tenantId = process.env.CORLEON_SANDBOX_TENANT_ID;

  if (!secret || secret.length < 32 || !tenantId) {
    return {
      ok: false,
      status: 503,
      error: "Sandbox API is not configured",
      requestId,
    };
  }

  const authorization = request.headers.get("authorization") ?? "";
  const supplied = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";

  // Hash both values to fixed-length digests before the constant-time comparison.
  const expectedDigest = createHash("sha256").update(secret, "utf8").digest();
  const suppliedDigest = createHash("sha256").update(supplied, "utf8").digest();
  if (!supplied || !timingSafeEqual(expectedDigest, suppliedDigest)) {
    return { ok: false, status: 401, error: "Unauthorized", requestId };
  }

  return { ok: true, tenantId, requestId };
}
