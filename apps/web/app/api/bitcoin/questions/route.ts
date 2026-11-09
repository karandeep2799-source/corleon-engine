import { NextRequest, NextResponse } from "next/server";
import { stackExchange } from "../../../../../lib/bitcoin/stackexchange";
import { bitcoinPrisma } from "../../../../../lib/bitcoin/prisma";

export const runtime = "nodejs";

type StackExchangeQuestion = {
  question_id: number; title: string; body?: string; link: string; score: number;
  answer_count?: number; view_count?: number; is_answered?: boolean; tags?: string[];
  creation_date?: number; owner?: { display_name?: string };
};

export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 160);
  const sortInput = request.nextUrl.searchParams.get("sort") ?? "activity";
  const sort = ["activity", "votes", "creation", "hot"].includes(sortInput) ? sortInput : "activity";
  const page = Math.min(20, Math.max(1, Number(request.nextUrl.searchParams.get("page") ?? 1) || 1));
  try {
    const local = await bitcoinPrisma.bitcoinQuestion.findMany({
      where: { status: "PUBLISHED", ...(query ? { OR: [{ title: { contains: query, mode: "insensitive" } }, { body: { contains: query, mode: "insensitive" } }] } : {}) },
      orderBy: [{ score: "desc" }, { createdAt: "desc" }], take: 12,
      select: { id: true, title: true, body: true, authorName: true, tags: true, score: true, answerCount: true, createdAt: true }
    }).catch(() => []);
    const remote = await stackExchange<StackExchangeQuestion>(query ? "/search/advanced" : "/questions", query
      ? { q: query, sort: "relevance", order: "desc", page }
      : { sort, order: "desc", page });
    return NextResponse.json({
      local,
      external: remote.items.map((q) => ({
        id: q.question_id, title: q.title, body: q.body ?? "", link: q.link,
        score: q.score, answerCount: q.answer_count, viewCount: q.view_count,
        isAnswered: q.is_answered, tags: q.tags ?? [], createdAt: q.creation_date,
        author: q.owner?.display_name ?? "Bitcoin Stack Exchange community", source: "stackexchange"
      })),
      hasMore: remote.has_more, quotaRemaining: remote.quota_remaining
    }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
  } catch (error) {
    console.error("Bitcoin questions lookup failed", error);
    return NextResponse.json({ error: "Bitcoin question search is temporarily unavailable." }, { status: 502 });
  }
}
