"use client";

import { useState } from "react";
import type { CSSProperties, FormEvent } from "react";

type ResearchResult = {
  provider: string;
  model: string;
  mode: "google-ai-mode" | "google-web-search";
  query: string;
  answer: string;
  searchQueries: string[];
  sources: Array<{ url: string; title: string }>;
  retrievedAt: string;
};

const styles: Record<string, CSSProperties> = {
  shell: { maxWidth: 920, margin: "0 auto", padding: "28px 20px 64px", fontFamily: "system-ui, sans-serif", color: "#111827" },
  nav: { display: "flex", justifyContent: "space-between", gap: 16, color: "#64748b", fontSize: 13, paddingBottom: 42 },
  brand: { color: "#111827", fontWeight: 800, textDecoration: "none" },
  hero: { padding: "20px 0 34px", maxWidth: 720 },
  kicker: { fontSize: 11, fontWeight: 800, letterSpacing: ".16em", color: "#64748b" },
  heading: { fontSize: "clamp(3.5rem, 10vw, 6.5rem)", lineHeight: .95, letterSpacing: "-.06em", margin: "12px 0" },
  lede: { color: "#64748b", fontSize: 18, lineHeight: 1.6, maxWidth: 600 },
  panel: { padding: 24, border: "1px solid #e5e7eb", borderRadius: 18, background: "#fff", display: "grid", gap: 12 },
  label: { fontSize: 13, fontWeight: 700, marginTop: 5 },
  field: { width: "100%", boxSizing: "border-box", border: "1px solid #d1d5db", borderRadius: 10, padding: 13, font: "inherit", background: "#fff", color: "#111827" },
  footer: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, color: "#64748b", fontSize: 12, flexWrap: "wrap" },
  button: { border: 0, borderRadius: 999, background: "#111827", color: "#fff", padding: "12px 20px", fontWeight: 700, cursor: "pointer" },
  result: { marginTop: 22, padding: 24, border: "1px solid #e5e7eb", borderRadius: 18, background: "#fff", lineHeight: 1.75 },
  error: { marginTop: 18, padding: 14, borderRadius: 12, border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b" },
};

export default function ResearchPage() {
  const [input, setInput] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResult(null);
    setLoading(true);
    try {
      const response = await fetch("/api/integrations/google-search", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ input }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Research request failed.");
      setResult(payload as ResearchResult);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Research request failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={styles.shell}>
      <nav style={styles.nav}>
        <a href="/" style={styles.brand}>Corleon Engine</a>
        <span>Google Search · Grounded AI</span>
      </nav>
      <header style={styles.hero}>
        <p style={styles.kicker}>CORLEON RESEARCH</p>
        <h1 style={styles.heading}>Search deeper.<br />Know why.</h1>
        <p style={styles.lede}>Run web research through Google&apos;s supported Search grounding, with source links and query transparency.</p>
      </header>
      <form onSubmit={submit} style={styles.panel}>
        <label htmlFor="research-input" style={styles.label}>Search query or Google Search URL</label>
        <textarea
          id="research-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask a question, or paste a Google URL such as https://www.google.com/search?q=..."
          rows={4}
          maxLength={4000}
          required
          style={styles.field}
        />
        <label htmlFor="research-token" style={styles.label}>Research access token</label>
        <input
          id="research-token"
          type="password"
          value={accessToken}
          onChange={(event) => setAccessToken(event.target.value)}
          placeholder="Enter CORLEON_RESEARCH_ACCESS_TOKEN"
          autoComplete="off"
          required
          style={styles.field}
        />
        <div style={styles.footer}>
          <span>AI Mode URLs are translated into supported Gemini Search grounding.</span>
          <button type="submit" disabled={loading || !input.trim() || !accessToken.trim()} style={{ ...styles.button, opacity: loading ? .55 : 1 }}>
            {loading ? "Researching…" : "Start research"}
          </button>
        </div>
      </form>
      {error && <div role="alert" style={styles.error}>{error}</div>}
      {result && (
        <section style={styles.result} aria-live="polite">
          <div style={styles.footer}>
            <span>{result.mode === "google-ai-mode" ? "Google AI Mode URL · Grounded" : "Google Search · Grounded"}</span>
            <span>{new Date(result.retrievedAt).toLocaleString()}</span>
          </div>
          <h2>{result.query}</h2>
          <article style={{ whiteSpace: "pre-wrap" }}>{result.answer}</article>
          {result.searchQueries.length > 0 && (
            <div>
              <h3>Searches performed</h3>
              <ul>{result.searchQueries.map((query) => <li key={query}>{query}</li>)}</ul>
            </div>
          )}
          <div>
            <h3>Sources ({result.sources.length})</h3>
            <ul>{result.sources.map((source) => (
              <li key={source.url}>
                <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a>
                {" — "}{new URL(source.url).hostname}
              </li>
            ))}</ul>
          </div>
          <p style={{ color: "#64748b", fontSize: 12 }}>Generated with {result.provider} · {result.model}. Verify critical claims against linked sources.</p>
        </section>
      )}
      <footer style={{ ...styles.footer, marginTop: 26 }}>
        <a href="/" style={styles.brand}>Back to Corleon Engine</a>
        <span>Provider keys stay server-side. Access token remains in page memory only.</span>
      </footer>
    </main>
  );
}
