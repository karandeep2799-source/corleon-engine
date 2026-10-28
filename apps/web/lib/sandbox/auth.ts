import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

export type SandboxAuthResult = "ok" | "missing_configuration" | "unauthorized";

export function authorizeSandboxRequest(request: NextRequest): SandboxAuthResult {
  const expected = process.env.CORLEON_SANDBOX_API_KEY;
  if (!expected || expected.length < 32) return "missing_configuration";

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return "unauthorized";

  const candidate = authorization.slice("Bearer ".length);
  const expectedBuffer = Buffer.from(expected, "utf8");
  const candidateBuffer = Buffer.from(candidate, "utf8");

  if (candidateBuffer.length !== expectedBuffer.length) return "unauthorized";
  return timingSafeEqual(candidateBuffer, expectedBuffer) ? "ok" : "unauthorized";
}

export function requestId(request: NextRequest): string {
  const supplied = request.headers.get("x-request-id");
  if (supplied && /^[A-Za-z0-9._:-]{1,100}$/.test(supplied)) return supplied;
  return crypto.randomUUID();
}
