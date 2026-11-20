import type { NextRequest } from "next/server";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

function clientAddress(request: NextRequest): string {
  const direct = request.headers.get("x-real-ip")?.trim();
  if (direct) return direct;
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded ? forwarded.split(",").at(-1)?.trim() || "unknown" : "unknown";
}

/**
 * Per-instance fallback only. Configure Upstash Redis or Vercel Firewall for
 * strict global limits across serverless instances.
 */
export async function isRateLimited(request: NextRequest, scope: string, limit: number, windowSeconds = 60): Promise<boolean> {
  const key = "corleon:blockscout:" + scope + ":" + clientAddress(request);
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.replace(/\\/$/, "");
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (redisUrl && redisToken) {
    const init = { headers: { authorization: "Bearer " + redisToken }, cache: "no-store" as const, signal: AbortSignal.timeout(3000) };
    const encoded = encodeURIComponent(key);
    const create = await fetch(redisUrl + "/set/" + encoded + "/0/EX/" + windowSeconds + "/NX", init);
    if (!create.ok) throw new Error("Distributed rate limiter is unavailable.");
    const increment = await fetch(redisUrl + "/incr/" + encoded, init);
    if (!increment.ok) throw new Error("Distributed rate limiter is unavailable.");
    const result = await increment.json() as { result?: number | string };
    const count = Number(result.result);
    if (!Number.isFinite(count)) throw new Error("Distributed rate limiter returned an invalid result.");
    return count > limit;
  }
  const now = Date.now();
  if (buckets.size > 10000) for (const [bucketKey, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(bucketKey);
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return false;
  }
  current.count += 1;
  return current.count > limit;
}
