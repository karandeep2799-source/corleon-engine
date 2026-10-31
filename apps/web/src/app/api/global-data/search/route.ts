import { boundedInteger, jsonError, worldBankGet } from "@/lib/world-bank/client";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim();
  const type = url.searchParams.get("type") === "resource" ? "resource" : "dataset";

  if (query.length < 2 || query.length > 160) {
    return Response.json(
      { error: "invalid_query", message: "Search must contain 2–160 characters." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const payload = await worldBankGet<unknown>("/search", {
      qname: type,
      param: query,
      top: boundedInteger(url.searchParams.get("top"), 25, 1, 100),
      skip: boundedInteger(url.searchParams.get("skip"), 0, 0, 1_000_000),
    });

    return Response.json(payload, {
      headers: { "Cache-Control": "public, s-maxage=180, stale-while-revalidate=300" },
    });
  } catch (error) {
    return jsonError(error);
  }
}
