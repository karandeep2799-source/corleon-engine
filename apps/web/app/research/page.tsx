"use client";

import { FormEvent, useState } from "react";

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
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
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
    <main className="research-shell">
      <nav className="research-nav">
        <a href="/" className="research-brand">Corleon Engine</a>
        <span>Google Search · Grounded AI</span>
      </nav>

      <section className="research-hero">
        <p className="research-kicker">CORLEON RESEARCH</p>
        <h1>Search deeper.<br />Know why.</h1>
        <p>Run web research through Google's supported Search grounding, with source links and query transparency.</p>
      </section>

      <form className="research-form" onSubmit={submit}>
        <label htmlFor="research-input">Search query or Google Search URL</label>
        <textarea
          id="research-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask a question, or paste a Google URL such as https://www.google.com/search?q=..."
          rows={4}
          maxLength={4000}
          required
        />
        <label htmlFor="research-token">Research access token</label>
        <input
          id="research-token"
          type="password"
          value={accessToken}
          onChange={(event) => setAccessToken(event.target.value)}
          placeholder="Enter the CORLEON_RESEARCH_ACCESS_TOKEN"
          autoComplete="off"
          required
        />
        <div className="research-form-footer">
          <span>AI Mode links are translated into supported Gemini Search grounding.</span>
          <button type="submit" disabled={loading || !input.trim() || !accessToken.trim()}>
            {loading ? "Researching…" : "Start research"}
          </button>
        </div>
      </form>

      {error && <div className="research-error" role="alert">{error}</div>}

      {result && (
        <section className="research-results" aria-live="polite">
          <div className="research-result-meta">
            <span>{result.mode === "google-ai-mode" ? "Google AI Mode URL · Grounded" : "Google Search · Grounded"}</span>
            <span>{new Date(result.retrievedAt).toLocaleString()}</span>
          </div>
          <h2>{result.query}</h2>
          <article className="research-answer">{result.answer}</article>

          {result.searchQueries.length > 0 && (
            <div className="research-sources">
              <h3>Searches performed</h3>
              <ul>{result.searchQueries.map((query) => <li key={query}>{query}</li>)}</ul>
            </div>
          )}

          <div className="research-sources">
            <h3>Sources ({result.sources.length})</h3>
            {result.sources.length === 0 ? (
              <p>No source links were returned by the provider for this response.</p>
            ) : (
              <ul>
                {result.sources.map((source) => (
                  <li key={source.url}>
                    <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a>
                    <span>{new URL(source.url).hostname}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="research-footnote">Generated with {result.provider} · {result.model}. Verify critical claims against the linked sources.</p>
        </section>
      )}

      <footer className="research-footer">
        <a href="/">Back to Corleon Engine</a>
        <span>Provider keys stay server-side. Access tokens are held only in this page's memory.</span>
      </footer>
    </main>
  );
}
