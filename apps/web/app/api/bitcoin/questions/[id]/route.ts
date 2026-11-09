import { NextRequest, NextResponse } from "next/server";
import { stackExchange } from "../../../../../lib/bitcoin/stackexchange";

export const runtime = "nodejs";

type StackExchangeQuestion = { question_id: number; title?: string; body?: string; link?: string; score: number; answer_count?: number; view_count?: number; is_answered?: boolean; tags?: string[]; creation_date?: number; owner?: { display_name?: string } };
type StackExchangeAnswer = { answer_id: number; body?: string; score: number; is_accepted?: boolean; owner?: { display_name?: string } };

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^\d{1,12}$/.test(id)) return NextResponse.json({ error: "Invalid question id." }, { status: 400 });
  try {
    const [questions, answers] = await Promise.all([
      stackExchange<StackExchangeQuestion>(`/questions/${id}`, { order: "desc", sort: "activity" }),
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
