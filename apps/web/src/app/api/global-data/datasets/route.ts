import { boundedInteger, jsonError, worldBankGet } from "@/lib/world-bank/client";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const top = boundedInteger(url.searchParams.get("top"), 25, 1, 100);
    const skip = boundedInteger(url.searchParams.get("skip"), 0, 0, 1_000_000);
    const payload = await worldBankGet<unknown>("/datasets", { top, skip });

    return Response.json(payload, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch (error) {
    return jsonError(error);
  }
}
