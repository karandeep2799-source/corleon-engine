"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type Holding = { symbol: string; companyName: string | null; currency: string; quantity: number; costBasis: number; realizedPnl: number; averageCost: number };
type Transaction = {
  id: string; symbol: string; companyName: string | null; type: string; quantity: string; price: string;
  amount: string | null; currency: string; executedAt: string; confidence: number; reviewStatus: string;
  evidenceExcerpt: string; sourceSubject: string; sourceSender: string | null; sourceUrl: string;
};
type Source = { id: string; subject: string; sender: string | null; receivedAt: string | null; hasFinancialData: boolean; attachments: Array<{ filename: string; mimeType: string; parsed: boolean }>; sourceUrl: string };
type Portfolio = {
  connected: boolean; account?: { email: string; name: string | null; picture: string | null };
  summary?: { holdingsCount: number; pendingReview: number; confirmedTransactions: number; scannedEmails: number; lastSyncedAt: string | null; scanComplete: boolean };
  holdings: Holding[]; transactions: Transaction[]; sources: Source[];
};
const emptyPortfolio: Portfolio = { connected: false, holdings: [], transactions: [], sources: [] };

function money(value: number, currency: string) {
  try { return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value); }
  catch { return `${currency} ${value.toFixed(2)}`; }
}
function date(value: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
const errors: Record<string, string> = {
  google_consent_declined: "Google access was cancelled.",
  oauth_state_invalid: "The Google sign-in session expired. Please try again.",
  google_refresh_token_missing: "Google did not provide offline Gmail access. Reconnect and approve the requested access.",
  gmail_readonly_scope_missing: "Gmail read-only permission was not granted.",
  google_connection_failed: "Google could not be connected. Check the OAuth setup and try again.",
};

export default function StocksWorkspace() {
  const [data, setData] = useState<Portfolio>(emptyPortfolio);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reviewing, setReviewing] = useState("");
  const [disconnecting, setDisconnecting] = useState(false);
  const searchParams = useSearchParams();
  const queryError = searchParams.get("error");
  const queryConnected = searchParams.get("connected");
  const visibleError = error || (queryError ? errors[queryError] ?? "Google connection failed." : "");
  const visibleNotice = notice || (queryConnected ? "Gmail is connected. Run a mailbox scan to extract stock activity." : "");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/stocks/portfolio", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load your portfolio.");
      setData({ ...emptyPortfolio, ...result });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your portfolio.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function syncMailbox() {
    setSyncing(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/stocks/sync", { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Mailbox scan failed.");
      setNotice(`Scanned ${result.scannedThisBatch} emails in this batch · ${result.scannedEmails} total · ${result.newTransactions} new trade candidates.${result.hasMore ? " More matching email remains; scan again to continue." : " The current search has been fully paged."} Review every candidate before it enters your holdings.`);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Mailbox scan failed."); }
    finally { setSyncing(false); }
  }

  async function review(id: string, action: "CONFIRM" | "IGNORE") {
    setReviewing(id); setError("");
    try {
      const response = await fetch(`/api/stocks/transactions/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update this trade.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not update this trade."); }
    finally { setReviewing(""); }
  }

  async function disconnect() {
    if (!window.confirm("Disconnect Gmail and delete all imported stock records from Corleon? This does not delete any Gmail messages.")) return;
    setDisconnecting(true); setError("");
    try {
      const response = await fetch("/api/stocks/auth/logout", { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not disconnect Gmail.");
      setData(emptyPortfolio);
      setNotice(result.googleRevoked ? "Gmail disconnected. Google access was revoked and imported stock records were deleted." : "Imported stock records were deleted locally, but Google token revocation could not be confirmed. Remove Corleon Engine access from your Google Account security settings.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not disconnect Gmail."); }
    finally { setDisconnecting(false); }
  }

  const pending = useMemo(() => data.transactions.filter((item) => item.reviewStatus === "NEEDS_REVIEW"), [data.transactions]);
  const confirmed = useMemo(() => data.transactions.filter((item) => item.reviewStatus === "CONFIRMED"), [data.transactions]);
  const costByCurrency = useMemo(() => data.holdings.reduce<Record<string, number>>((totals, item) => { totals[item.currency] = (totals[item.currency] ?? 0) + item.costBasis; return totals; }, {}), [data.holdings]);
  const costSummary = Object.entries(costByCurrency).map(([currency, amount]) => money(amount, currency)).join(" · ") || "—";

  return (
    <main className="stocks-shell">
      <nav className="stocks-nav">
        <Link className="stocks-brand" href="/"><span className="stocks-mark">C</span> CORLEON <span>/ STOCK INTELLIGENCE</span></Link>
        <div><Link href="/">Engine home</Link><a href="/bitcoin">Bitcoin Knowledge</a></div>
      </nav>

      <header className="stocks-hero">
        <div>
          <p className="stocks-eyebrow">PRIVATE PORTFOLIO WORKSPACE</p>
          <h1>Your stocks,<br /><span>out of your inbox.</span></h1>
          <p className="stocks-lede">Find shares, trade confirmations, contract notes and dividend-related emails. Corleon turns matching messages into a reviewable portfolio ledger.</p>
        </div>
        <div className="stocks-hero-card">
          <span className="stocks-status-dot" />
          <p>GMAIL ACCESS</p>
          <strong>{data.connected ? "Connected" : "Not connected"}</strong>
          <small>{data.connected ? data.account?.email : "Read-only permission is requested only after you connect."}</small>
        </div>
      </header>

      {visibleError && <div className="stocks-alert error" role="alert">{visibleError}</div>}
      {visibleNotice && <div className="stocks-alert" role="status">{visibleNotice}</div>}

      {!data.connected ? (
        <section className="stocks-connect">
          <div className="stocks-connect-icon">↗</div>
          <div>
            <p className="stocks-eyebrow">STEP 01 · CONNECT YOUR MAILBOX</p>
            <h2>Find your investment records.</h2>
            <p>Connect the Google account where your broker and depository emails arrive. Corleon requests Gmail read-only access; it cannot send, delete, archive or modify messages.</p>
          </div>
          <a className="stocks-button primary" href="/api/stocks/auth/google">Connect Gmail securely <span>→</span></a>
          <p className="stocks-privacy">By selecting Connect Gmail, you authorize Corleon to search your mailbox for investment-related messages, read their content and supported CSV/text attachments, and save the extracted trade candidates, source details and short evidence excerpts in this private workspace until you disconnect and delete the data. Corleon does not change email, place trades, sell or advertise with Google data, or send Gmail content to AI models. <Link href="/stocks/privacy">Read the Google data use and privacy notice ↗</Link></p>
        </section>
      ) : (
        <>
          <section className="stocks-toolbar">
            <div><span className="stocks-connected-pill">● Gmail connected</span><b>{data.account?.name || data.account?.email}</b></div>
            <div>
              <button className="stocks-button primary" onClick={syncMailbox} disabled={syncing || loading}>{syncing ? "Scanning inbox…" : data.summary?.scanComplete ? "Rescan stock emails →" : data.summary?.scannedEmails ? "Continue older email scan →" : "Scan stock emails →"}</button>
              <button className="stocks-button muted" onClick={disconnect} disabled={disconnecting}>{disconnecting ? "Disconnecting…" : "Disconnect & delete data"}</button>
            </div>
          </section>

          <section className="stocks-metrics">
            <article><span>CONFIRMED HOLDINGS</span><strong>{data.summary?.holdingsCount ?? 0}</strong><small>Built from approved trade rows</small></article>
            <article><span>ESTIMATED COST BASIS</span><strong>{costSummary}</strong><small>Not a live market valuation</small></article>
            <article><span>NEEDS YOUR REVIEW</span><strong>{data.summary?.pendingReview ?? 0}</strong><small>Unverified email extractions</small></article>
            <article><span>EMAILS SCANNED</span><strong>{data.summary?.scannedEmails ?? 0}</strong><small>{data.summary?.lastSyncedAt ? `Last scan ${date(data.summary.lastSyncedAt)}` : "No scan completed yet"}</small></article>
          </section>

          <section className="stocks-section">
            <div className="stocks-section-head"><div><p className="stocks-eyebrow">YOUR PORTFOLIO</p><h2>Confirmed positions</h2></div><span>Calculated from approved BUY / SELL records</span></div>
            {data.holdings.length ? (
              <div className="stocks-table-wrap"><table className="stocks-table"><thead><tr><th>STOCK</th><th>QUANTITY</th><th>AVG. COST</th><th>COST BASIS</th><th>REALIZED P&L</th></tr></thead>
                <tbody>{data.holdings.map((item) => <tr key={item.currency + item.symbol}><td><b>{item.symbol}</b><small>{item.companyName || "Company name not identified"}</small></td><td>{item.quantity.toLocaleString("en-IN", { maximumFractionDigits: 6 })}</td><td>{money(item.averageCost, item.currency)}</td><td>{money(item.costBasis, item.currency)}</td><td className={item.realizedPnl >= 0 ? "positive" : "negative"}>{money(item.realizedPnl, item.currency)}</td></tr>)}</tbody></table></div>
            ) : <div className="stocks-empty">No confirmed positions yet. Scan Gmail, then approve the correct trade rows below. Market prices are intentionally not estimated.</div>}
          </section>

          <section className="stocks-section">
            <div className="stocks-section-head"><div><p className="stocks-eyebrow">HUMAN VERIFICATION</p><h2>Review extracted trades</h2></div><span>{pending.length} awaiting approval</span></div>
            {pending.length ? <div className="stocks-review-list">{pending.map((item) => <article className="stocks-review" key={item.id}>
              <div className="stocks-review-main"><div className="stocks-review-title"><b>{item.type} {item.symbol}</b><span>rule-match score {item.confidence}/100 · verify against source</span></div>
                <p>{item.quantity} shares × {money(Number(item.price), item.currency)} · {date(item.executedAt)}</p>
                <small>{item.sourceSubject} · {item.sourceSender || "Unknown sender"}</small>
                <blockquote>{item.evidenceExcerpt}</blockquote>
                <a href={item.sourceUrl} target="_blank" rel="noreferrer">Open original email ↗</a>
              </div>
              <div className="stocks-review-actions"><button className="stocks-button primary" onClick={() => review(item.id, "CONFIRM")} disabled={reviewing === item.id}>Approve</button><button className="stocks-button muted" onClick={() => review(item.id, "IGNORE")} disabled={reviewing === item.id}>Ignore</button></div>
            </article>)}</div> : <div className="stocks-empty">Nothing needs review. Newly extracted trades always stay out of your portfolio until you approve them.</div>}
          </section>

          <section className="stocks-section">
            <div className="stocks-section-head"><div><p className="stocks-eyebrow">SOURCE MAILBOX</p><h2>Investment-related emails</h2></div><span>{data.sources.length} recent source records</span></div>
            {data.sources.length ? <div className="stocks-source-list">{data.sources.map((item) => <a className="stocks-source" key={item.id} href={item.sourceUrl} target="_blank" rel="noreferrer">
              <span className="stocks-source-icon">✉</span><span><b>{item.subject}</b><small>{item.sender || "Unknown sender"} · {date(item.receivedAt)}</small>{item.attachments.length > 0 && <small className="stocks-source-files">{item.attachments.map((attachment) => `${attachment.filename}${attachment.parsed ? " · parsed" : " · not parsed"}`).join(" · ")}</small>}</span>
              <span className="stocks-source-meta">{item.hasFinancialData ? "Trade data found" : "Review source"}{item.attachments.length ? ` · ${item.attachments.filter((attachment) => attachment.parsed).length} text/CSV parsed · ${item.attachments.filter((attachment) => !attachment.parsed).length} other/unsupported` : ""}</span>
            </a>)}</div> : <div className="stocks-empty">No source emails imported yet.</div>}
          </section>

          <section className="stocks-section">
            <div className="stocks-section-head"><div><p className="stocks-eyebrow">AUDITABLE ACTIVITY</p><h2>Confirmed trade ledger</h2></div><span>{confirmed.length} approved rows</span></div>
            {confirmed.length ? <div className="stocks-table-wrap"><table className="stocks-table"><thead><tr><th>DATE</th><th>TYPE</th><th>SYMBOL</th><th>QTY</th><th>PRICE</th><th>SOURCE</th></tr></thead><tbody>
              {confirmed.map((item) => <tr key={item.id}><td>{date(item.executedAt)}</td><td>{item.type}</td><td><b>{item.symbol}</b></td><td>{item.quantity}</td><td>{money(Number(item.price), item.currency)}</td><td><a href={item.sourceUrl} target="_blank" rel="noreferrer">Email ↗</a></td></tr>)}
            </tbody></table></div> : <div className="stocks-empty">Approved activity will appear here.</div>}
          </section>
        </>
      )}

      <footer className="stocks-footer">
        <p>DATA SAFETY</p>
        <span>Gmail is connected with the <code>gmail.readonly</code> scope only. Email bodies and attachments are not retained. Attachment names are recorded as evidence, but PDFs and scans are not parsed in this release. Every extracted trade requires manual approval. No broker login, order placement, trading, selling or investment advice is performed.</span>
      </footer>
    </main>
  );
}
