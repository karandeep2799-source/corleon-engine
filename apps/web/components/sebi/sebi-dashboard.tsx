"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Document = { id: string; title: string; canonicalUrl: string; description: string | null; category: string; publishedAt: string | null; fetchedAt: string; status: string };
type Source = { id: string; title: string; url: string; category: string; publishedAt: string | null };
type Answer = { answer: string; sources: Source[]; mode: string; disclaimer: string };
const categories = ["All", "Circular", "Regulation", "Enforcement", "Press release", "Intermediaries", "Investor protection", "Other"];
const dateLabel = (value: string | null) => {
  if (!value) return "Date not supplied";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date not supplied" : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

export default function SebiDashboard() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [loading, setLoading] = useState(true);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");

  const loadDocuments = useCallback(async (search: string, selectedCategory: string) => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ limit: "30" });
      if (search.trim()) params.set("q", search.trim());
      if (selectedCategory !== "All") params.set("category", selectedCategory);
      const response = await fetch("/api/sebi/documents?" + params.toString(), { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load SEBI records.");
      setDocuments(data.documents ?? []); setTotal(data.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load SEBI records.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadDocuments("", "All"); }, [loadDocuments]);

  async function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (question.trim().length < 8) return;
    setAsking(true); setAnswer(null); setError("");
    try {
      const response = await fetch("/api/sebi/ask", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The research request failed.");
      setAnswer(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The research request failed.");
    } finally { setAsking(false); }
  }

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadDocuments(query, category);
  }

  return (
    <main className="sebi-shell">
      <nav className="sebi-nav">
        <a className="sebi-brand" href="/"><span className="sebi-mark">C</span> CORLEON <span>/ REGULATORY INTELLIGENCE</span></a>
        <div><a href="https://www.sebi.gov.in/" target="_blank" rel="noreferrer">SEBI official site ↗</a><a href="https://scores.sebi.gov.in/" target="_blank" rel="noreferrer">SCORES 2.0 ↗</a></div>
      </nav>
      <section className="sebi-hero">
        <p className="sebi-eyebrow">INDIA · SECURITIES REGULATION · SOURCE-GROUNDED RESEARCH</p>
        <h1>Regulatory clarity.<br /><span>Backed by evidence.</span></h1>
        <p className="sebi-lede">A searchable intelligence workspace for SEBI circulars, regulations, orders, investor protection and market-intermediary guidance.</p>
        <div className="sebi-stats">
          <div><strong>{total.toLocaleString("en-IN")}</strong><span>Indexed records</span></div>
          <div><strong>Official</strong><span>SEBI source priority</span></div>
          <div><strong>Read-only</strong><span>Regulatory monitoring</span></div>
        </div>
      </section>
      <section className="sebi-assistant">
        <div className="sebi-section-heading"><div><p className="sebi-eyebrow">CORLEON AI RESEARCH</p><h2>Ask the regulatory assistant</h2><p>Answers use indexed SEBI material and link back to source records.</p></div><span className="sebi-chip">SOURCE-GROUNDED</span></div>
        <form onSubmit={submitQuestion}>
          <textarea value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={1200} placeholder="Example: What does SEBI's investor grievance process say about approaching a regulated entity before filing on SCORES?" />
          <div className="sebi-form-foot"><span>{question.length}/1200 · General information only</span><button disabled={asking || question.trim().length < 8}>{asking ? "Researching…" : "Research question →"}</button></div>
        </form>
        {answer && <div className="sebi-answer">
          <div className="sebi-answer-top"><span>{answer.mode === "ai-assisted" ? "AI-ASSISTED RESEARCH" : "SOURCE RETRIEVAL"}</span><span>{answer.sources.length} sources</span></div>
          <p>{answer.answer}</p>
          <div className="sebi-answer-sources">{answer.sources.map((source) => <a key={source.id} href={source.url} target="_blank" rel="noreferrer"><b>{source.title}</b><small>{source.category} · {dateLabel(source.publishedAt)}</small></a>)}</div>
          <small>{answer.disclaimer}</small>
        </div>}
      </section>
      <section className="sebi-library">
        <div className="sebi-section-heading"><div><p className="sebi-eyebrow">OFFICIAL SOURCE LIBRARY</p><h2>Regulatory documents</h2><p>Feed discoveries are stored once and updated when source metadata changes.</p></div><span className="sebi-live">● INDEXED LIBRARY</span></div>
        <form className="sebi-search" onSubmit={search}><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search circulars, orders, intermediaries, investor protection…" /><button>Search</button></form>
        <div className="sebi-categories">{categories.map((item) => <button type="button" key={item} className={category === item ? "active" : ""} onClick={() => { setCategory(item); void loadDocuments(query, item); }}>{item}</button>)}</div>
        {error && <div className="sebi-error">{error}</div>}
        {loading ? <div className="sebi-empty">Loading official source records…</div> :
          documents.length === 0 ? <div className="sebi-empty">No indexed records yet. Apply the database migration and run the first protected feed sync.</div> :
          <div className="sebi-doc-list">{documents.map((doc) => <article className="sebi-doc" key={doc.id}>
            <div className="sebi-doc-meta"><span>{doc.category}</span><time>{dateLabel(doc.publishedAt)}</time></div>
            <h3><a href={doc.canonicalUrl} target="_blank" rel="noreferrer">{doc.title} ↗</a></h3>
            {doc.description && <p>{doc.description}</p>}
            <div className="sebi-doc-foot"><span>Source: SEBI official RSS</span><span>{doc.status.toLowerCase()}</span></div>
          </article>)}</div>}
      </section>
      <section className="sebi-links">
        <a href="https://www.sebi.gov.in/legal/circulars.html" target="_blank" rel="noreferrer"><b>SEBI circulars</b><span>Official regulatory updates ↗</span></a>
        <a href="https://www.sebi.gov.in/legal/regulations.html" target="_blank" rel="noreferrer"><b>SEBI regulations</b><span>Regulatory framework ↗</span></a>
        <a href="https://investor.sebi.gov.in/" target="_blank" rel="noreferrer"><b>Investor education</b><span>Investor protection resources ↗</span></a>
        <a href="https://scores.sebi.gov.in/faqs" target="_blank" rel="noreferrer"><b>SCORES FAQs</b><span>Grievance process guidance ↗</span></a>
      </section>
      <footer className="sebi-footer"><span>Corleon Engine · SEBI Intelligence</span><span>Independent research utility. Not affiliated with or endorsed by SEBI.</span></footer>
    </main>
  );
}
