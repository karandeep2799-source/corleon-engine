"use client";

import { useCallback, useEffect, useState } from "react";

type Question = {
  id: number; title: string; link: string; score: number; answerCount: number;
  viewCount: number; isAnswered: boolean; tags: string[]; author: string; source: string;
};
type Source = { id: number; title: string; url: string; score: number; accepted: boolean; tags: string[]; excerpt: string };

const topics = ["bitcoin-core", "lightning-network", "transactions", "wallet", "script", "consensus", "segwit", "taproot"];

export default function BitcoinWorkspace() {
  const [tab, setTab] = useState<"questions" | "research">("questions");
  const [query, setQuery] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [researchQuestion, setResearchQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [asking, setAsking] = useState(false);

  const loadQuestions = useCallback(async (search = "") => {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/bitcoin/questions?q=${encodeURIComponent(search)}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load questions.");
      const data = await response.json();
      const local = (data.local ?? []).map((q: any) => ({
        id: q.id, title: q.title, link: `/bitcoin/questions/${q.id}`, score: q.score,
        answerCount: q.answerCount, viewCount: 0, isAnswered: q.answerCount > 0,
        tags: q.tags ?? [], author: q.authorName, source: "corleon"
      }));
      setQuestions([...local, ...(data.external ?? [])]);
    } catch (e) { setError(e instanceof Error ? e.message : "Search failed."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadQuestions(); }, [loadQuestions]);

  async function askResearch(event: React.FormEvent) {
    event.preventDefault();
    if (researchQuestion.trim().length < 8) return;
    setAsking(true); setAnswer(""); setSources([]); setError("");
    try {
      const response = await fetch("/api/bitcoin/ask", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: researchQuestion })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Research failed.");
      setAnswer(data.answer); setSources(data.sources ?? []);
    } catch (e) { setError(e instanceof Error ? e.message : "Research failed."); }
    finally { setAsking(false); }
  }

  return (
    <main className="btc-shell">
      <header className="btc-nav">
        <a href="/" className="btc-brand"><span className="btc-mark">₿</span><span>corleon<span className="btc-muted"> / bitcoin</span></span></a>
        <nav><a href="/">Engine home</a><a href="https://bitcoin.org/en/developer-documentation" target="_blank" rel="noreferrer">Developer docs ↗</a></nav>
      </header>

      <section className="btc-hero">
        <p className="btc-kicker">CORLEON KNOWLEDGE INTELLIGENCE · BITCOIN</p>
        <h1>Understand Bitcoin.<br /><span>Build with confidence.</span></h1>
        <p className="btc-lede">A technical Q&A workspace and AI research assistant grounded in Bitcoin Stack Exchange discussions and developer references.</p>
        <div className="btc-stats"><div><b>01</b><span>Community Q&A</span></div><div><b>02</b><span>AI research</span></div><div><b>03</b><span>Source citations</span></div></div>
      </section>

      <section className="btc-workspace">
        <div className="btc-tabs" role="tablist" aria-label="Bitcoin workspace">
          <button className={tab === "questions" ? "active" : ""} onClick={() => setTab("questions")} role="tab" aria-selected={tab === "questions"}>Explore questions</button>
          <button className={tab === "research" ? "active" : ""} onClick={() => setTab("research")} role="tab" aria-selected={tab === "research"}>Ask Bitcoin AI</button>
        </div>

        {tab === "questions" ? <div className="btc-panel">
          <div className="btc-panel-head"><div><p className="btc-kicker">COMMUNITY KNOWLEDGE</p><h2>Questions developers are solving</h2></div><span className="btc-live">LIVE SOURCE</span></div>
          <form className="btc-search" onSubmit={e => { e.preventDefault(); void loadQuestions(query); }}>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search Bitcoin Core, transactions, scripts..." aria-label="Search Bitcoin questions" />
            <button type="submit" disabled={loading}>{loading ? "Searching…" : "Search"}</button>
          </form>
          <div className="btc-topic-row">{topics.map(tag => <button key={tag} onClick={() => { setQuery(tag); void loadQuestions(tag); }}>{tag}</button>)}</div>
          {error && <p className="btc-error" role="alert">{error}</p>}
          <div className="btc-question-list">
            {questions.map((q, i) => <article className="btc-question" key={`${q.source}-${q.id}-${i}`}>
              <div className="btc-q-metrics"><b>{q.score}</b><span>votes</span><b>{q.answerCount}</b><span>answers</span></div>
              <div className="btc-q-content"><a href={q.link}>{q.title}</a>
                <div className="btc-tags">{q.tags.slice(0, 5).map(tag => <span key={tag}>{tag}</span>)}</div>
                <small>{q.author} · {q.source === "stackexchange" ? "Bitcoin Stack Exchange" : "Corleon community"}</small>
              </div>
              <span className={q.isAnswered ? "btc-answered" : "btc-unanswered"}>{q.isAnswered ? "Answered" : "Open"}</span>
            </article>)}
            {!loading && questions.length === 0 && <div className="btc-empty">No matching questions yet. Try another term or ask the AI research assistant.</div>}
          </div>
          <p className="btc-attribution">External community posts are provided by <a href="https://bitcoin.stackexchange.com/" target="_blank" rel="noreferrer">Bitcoin Stack Exchange</a> and remain subject to their original licensing and attribution requirements.</p>
        </div> : <div className="btc-panel btc-ai-panel">
          <p className="btc-kicker">RETRIEVAL-AUGMENTED RESEARCH</p><h2>Ask a technical Bitcoin question.</h2>
          <p className="btc-subtle">Corleon searches relevant community discussions, then synthesizes an answer with traceable source links. Community posts can be incomplete or outdated; verify critical protocol details against primary documentation.</p>
          <form onSubmit={askResearch}>
            <textarea value={researchQuestion} onChange={e => setResearchQuestion(e.target.value)} minLength={8} maxLength={1200} placeholder="Example: How does Bitcoin Core validate a witness commitment in a block?" required />
            <div className="btc-form-foot"><span>{researchQuestion.length}/1200</span><button disabled={asking || researchQuestion.trim().length < 8}>{asking ? "Researching…" : "Research question →"}</button></div>
          </form>
          {error && <p className="btc-error" role="alert">{error}</p>}
          {answer && <section className="btc-answer" aria-live="polite"><p className="btc-kicker">CORLEON RESEARCH RESPONSE</p><div className="btc-answer-copy">{answer}</div>
            {sources.length > 0 && <div className="btc-sources"><h3>Source material</h3>{sources.map(s => <a key={s.id} href={s.url} target="_blank" rel="noreferrer"><b>[{s.id}] {s.title}</b><span>{s.score} votes · {s.accepted ? "Accepted answer exists" : "Community discussion"} · Bitcoin Stack Exchange ↗</span></a>)}</div>}
          </section>}
          <p className="btc-disclaimer">Never enter seed phrases, private keys, wallet backups, or exchange credentials. AI output is educational and must not be treated as transaction authorization or investment advice.</p>
        </div>}
      </section>
      <footer className="btc-footer"><span>Corleon Engine · Bitcoin Knowledge</span><span>Independent community platform · Not affiliated with Stack Exchange, Inc.</span></footer>
    </main>
  );
}
