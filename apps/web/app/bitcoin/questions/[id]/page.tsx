import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { stackExchange, cleanHtml } from "../../../../lib/bitcoin/stackexchange";
import { bitcoinPrisma } from "../../../../lib/bitcoin/prisma";

export const dynamic = "force-dynamic";

type RemotePost = {
  answer_id?: number; question_id?: number; title?: string; body?: string;
  score: number; is_accepted?: boolean; content_license?: string;
  owner?: { display_name?: string }; creation_date: number;
};

async function getLocalQuestion(id: string) {
  return bitcoinPrisma.bitcoinQuestion.findFirst({
    where: { id, status: "PUBLISHED" },
    include: { answers: { orderBy: [{ isAccepted: "desc" }, { score: "desc" }] } },
  });
}

type LocalQuestion = NonNullable<Awaited<ReturnType<typeof getLocalQuestion>>>;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: `Bitcoin question ${id} | Corleon Engine` };
}

export default async function BitcoinQuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (/^\\d{1,12}$/.test(id)) {
    let remoteQuestion: RemotePost | null = null;
    let remoteAnswers: RemotePost[] = [];
    try {
      const [questions, answers] = await Promise.all([
        stackExchange<RemotePost>(`/questions/${id}`, { order: "desc", sort: "activity" }),
        stackExchange<RemotePost>(`/questions/${id}/answers`, { order: "desc", sort: "votes" }),
      ]);
      remoteQuestion = questions.items[0] ?? null;
      remoteAnswers = answers.items ?? [];
    } catch (error) {
      console.error("Bitcoin detail page failed", error);
    }
    if (!remoteQuestion) notFound();
    const question = remoteQuestion;
    return <main className="btc-shell">
      <header className="btc-nav"><Link className="btc-brand" href="/bitcoin"><span className="btc-mark">₿</span>corleon / bitcoin</Link><Link href="/">Engine home</Link></header>
      <article className="btc-panel btc-detail">
        <p className="btc-kicker">BITCOIN STACK EXCHANGE · COMMUNITY QUESTION</p>
        <h1>{question.title ?? `Question #${id}`}</h1>
        <p className="btc-subtle">This post is displayed from the Stack Exchange API. Open the original post for full formatting, comments, edits and community actions.</p>
        <div className="btc-detail-post"><b>Question details</b><p>{cleanHtml(question.body)}</p></div>
        <div className="btc-sources"><h3>{remoteAnswers.length} answers</h3>{remoteAnswers.map((answer, index) => <article className="btc-detail-post" key={answer.answer_id ?? index}>
          <div className="btc-detail-meta"><b>{answer.score} votes</b>{answer.is_accepted && <span className="btc-answered">Accepted answer</span>}</div>
          <p>{cleanHtml(answer.body)}</p><small>{answer.owner?.display_name ?? "Community member"}</small>
        </article>)}</div>
        <p className="btc-attribution">Source: <a href={`https://bitcoin.stackexchange.com/questions/${id}`} target="_blank" rel="noreferrer">Bitcoin Stack Exchange original post ↗</a> · License: {question.content_license ?? "see original post"}</p>
      </article>
    </main>;
  }

  let localQuestion: LocalQuestion | null = null;
  try {
    localQuestion = await getLocalQuestion(id);
  } catch (error) {
    console.error("Local Bitcoin question unavailable", error);
  }
  if (!localQuestion) notFound();

  return <main className="btc-shell">
    <header className="btc-nav"><Link className="btc-brand" href="/bitcoin"><span className="btc-mark">₿</span>corleon / bitcoin</Link><Link href="/">Engine home</Link></header>
    <article className="btc-panel btc-detail">
      <p className="btc-kicker">CORLEON COMMUNITY QUESTION</p><h1>{localQuestion.title}</h1>
      <div className="btc-detail-post"><p>{localQuestion.body}</p><small>Asked by {localQuestion.authorName}</small></div>
      <div className="btc-sources"><h3>{localQuestion.answers.length} answers</h3>{localQuestion.answers.map((answer) => <article className="btc-detail-post" key={answer.id}>
        <div className="btc-detail-meta"><b>{answer.score} votes</b>{answer.isAccepted && <span className="btc-answered">Accepted answer</span>}</div>
        <p>{answer.body}</p><small>{answer.authorName}</small>
      </article>)}</div>
    </article>
  </main>;
}
