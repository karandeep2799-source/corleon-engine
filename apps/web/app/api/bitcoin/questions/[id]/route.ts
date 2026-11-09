import { NextRequest, NextResponse } from "next/server";
import { stackExchange } from "../../../../lib/bitcoin/stackexchange";

export const runtime = "nodejs";

type StackExchangeAnswer = { answer_id: number; question_id: number; body?: string; score: number; is_accepted?: boolean; content_license?: string; owner?: { display_name?: string }; creation_date: number };

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^\d{1,12}$/.test(id)) return NextResponse.json({ error: "Invalid question id." }, { status: 400 });
  try {
    const [questions, answers] = await Promise.all([
      stackExchange<{ question_id: number; title: string; body?: string; score: number; link: string; tags: string[]; owner?: { display_name?: string } }>(`/questions/${id}`, { order: "desc", sort: "activity" }),
      stackExchange<StackExchangeAnswer>(`/questions/${id}/answers`, { order: "desc", sort: "votes" })
    ]);
    return NextResponse.json({ question: questions.items[0] ?? null, answers: answers.items ?? [] }, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" }
    });
  } catch (error) {
    console.error("Bitcoin question detail failed", error);
    return NextResponse.json({ error: "Could not load this question." }, { status: 502 });
  }
}
