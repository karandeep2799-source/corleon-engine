import { NextRequest, NextResponse } from "next/server";
import { sebiPrisma } from "../../../../lib/sebi/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 120);
  const category = (request.nextUrl.searchParams.get("category") ?? "").trim().slice(0, 60);
  const limit = Math.min(50, Math.max(1, Number(request.nextUrl.searchParams.get("limit") ?? 20) || 20));
  try {
    const [documents, total, latestRun] = await Promise.all([
      sebiPrisma.sebiDocument.findMany({
        where: {
          status: { not: "ARCHIVED" },
          ...(category && category !== "All" ? { category } : {}),
          ...(query ? { OR: [
            { title: { contains: query, mode: "insensitive" } },
            { description: { contains: query, mode: "insensitive" } },
            { content: { contains: query, mode: "insensitive" } },
          ] } : {}),
        },
        orderBy: [{ publishedAt: "desc" }, { fetchedAt: "desc" }], take: limit,
        select: { id: true, title: true, canonicalUrl: true, description: true, category: true, publishedAt: true, fetchedAt: true, status: true },
      }),
      sebiPrisma.sebiDocument.count({ where: { status: { not: "ARCHIVED" } } }),
      sebiPrisma.sebiIngestionRun.findFirst({ orderBy: { startedAt: "desc" }, select: { status: true, startedAt: true, finishedAt: true, discovered: true, inserted: true, updated: true } }),
    ]);
    return NextResponse.json({ documents, total, latestRun }, { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } });
  } catch (error) {
    console.error("SEBI document search failed", error);
    return NextResponse.json({ error: "SEBI knowledge storage is unavailable. Apply the pending Prisma migration and retry." }, { status: 503 });
  }
}
