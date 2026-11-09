import { NextRequest, NextResponse } from "next/server";
import { stackExchange, cleanHtml } from "../../../../../lib/bitcoin/stackexchange";
import { bitcoinPrisma } from "../../../../../lib/bitcoin/prisma";

export const runtime = "nodejs";
export const maxDuration = 60;

type RemoteQuestion = {
  question_id: number; title: string; body?: string; link: string; score: number;
  tags: string[]; creation_date: number; owner?: { display_name?: string };
  accepted_answer_id?: number;
};

function licenseFor(timestamp: number) {
  if (timestamp < Date.UTC(2011, 3, 8) / 1000) return "CC BY-SA 2.5";
  if (timestamp < Date.UTC(2018, 4, 2) / 1000) return "CC BY-SA 3.0";
  return "CC BY-SA 4.0";
}

export async function POST(request: NextRequest) {
  const secret = process.env.BITCOIN_INGEST_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const tags = ["bitcoin-core", "lightning-network", "transactions", "wallet", "taproot"];
  let imported = 0;
  try {
    for (const tag of tags) {
      const result = await stackExchange<RemoteQuestion>("/questions", {
        tagged: tag, sort: "activity", order: "desc", pagesize: 30
      });
      for (const q of result.items) {
        await bitcoinPrisma.bitcoinKnowledgeSource.upsert({
          where: { externalId: q.question_id },
          create: {
            externalId: q.question_id, title: q.title, body: cleanHtml(q.body).slice(0, 24000),
            url: q.link, tags: q.tags, score: q.score, acceptedAnswerExists: Boolean(q.accepted_answer_id),
            authorName: q.owner?.display_name ?? null, creationDate: new Date(q.creation_date * 1000),
            license: licenseFor(q.creation_date), fetchedAt: new Date()
          },
          update: {
            title: q.title, body: cleanHtml(q.body).slice(0, 24000), url: q.link,
            tags: q.tags, score: q.score, acceptedAnswerExists: Boolean(q.accepted_answer_id),
            authorName: q.owner?.display_name ?? null, license: licenseFor(q.creation_date), fetchedAt: new Date()
          }
        });
        imported++;
      }
    }
    return NextResponse.json({ ok: true, processed: imported, tags, source: "Bitcoin Stack Exchange API v2.3" });
  } catch (error) {
    console.error("Bitcoin knowledge ingestion failed", error);
    return NextResponse.json({ error: "Knowledge ingestion failed.", processed: imported }, { status: 502 });
  }
}
