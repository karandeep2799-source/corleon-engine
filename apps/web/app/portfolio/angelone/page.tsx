"use client";

import { useState } from "react";
import type { FormEvent } from "react";

type Holding = {
  tradingsymbol: string;
  exchange: string;
  quantity: number;
  averageprice: number;
  ltp: number;
  profitandloss: number;
  pnlpercentage: number;
};

type Portfolio = {
  retrievedAt: string;
  holdings: Holding[];
  totalholding: {
    totalholdingvalue?: number;
    totalinvvalue?: number;
    totalprofitandloss?: number;
    totalpnlpercentage?: number;
  } | null;
  positions: Array<Record<string, unknown>>;
};

const money = (value?: number) =>
  typeof value === "number"
    ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value)
    : "—";

export default function AngelOnePortfolioPage() {
  const [accessToken, setAccessToken] = useState("");
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadPortfolio(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPortfolio(null);
    setLoading(true);
    try {
      const response = await fetch("/api/integrations/angelone/portfolio", {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "Unable to load portfolio.");
      setPortfolio(payload as Portfolio);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load portfolio.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 1120, margin: "0 auto", padding: "40px 20px", color: "var(--foreground, #f5f5f5)" }}>
      <p style={{ fontSize: 12, letterSpacing: 2, opacity: 0.65 }}>CORLEON PORTFOLIO INTELLIGENCE</p>
      <h1 style={{ fontSize: 36, margin: "8px 0" }}>Angel One portfolio</h1>
      <p style={{ maxWidth: 720, opacity: 0.72, lineHeight: 1.6 }}>
        Private, read-only holdings and positions. No order placement, modification, cancellation,
        position conversion, or fund movement is available in this integration.
      </p>

      <form onSubmit={loadPortfolio} style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "28px 0", padding: 18, border: "1px solid #444", borderRadius: 12 }}>
        <label htmlFor="access-token" style={{ width: "100%", fontSize: 13, opacity: 0.75 }}>Corleon portfolio access token</label>
        <input
          id="access-token"
          type="password"
          autoComplete="off"
          value={accessToken}
          onChange={(event) => setAccessToken(event.target.value)}
          placeholder="Enter the configured access token"
          required
          style={{ flex: "1 1 320px", minWidth: 0, padding: 12, borderRadius: 8, border: "1px solid #666", background: "transparent", color: "inherit" }}
        />
        <button type="submit" disabled={loading || !accessToken} style={{ padding: "12px 20px", borderRadius: 8, border: 0, cursor: "pointer", fontWeight: 700 }}>
          {loading ? "Connecting…" : "Load portfolio"}
        </button>
        <p style={{ width: "100%", margin: 0, fontSize: 12, opacity: 0.6 }}>The access token is held only in this page&apos;s memory and is not saved to browser storage.</p>
      </form>

      {error && <p role="alert" style={{ color: "#ff8f8f" }}>{error}</p>}

      {portfolio && (
        <>
          <p style={{ fontSize: 12, opacity: 0.65 }}>Retrieved {new Date(portfolio.retrievedAt).toLocaleString("en-IN")}</p>
          <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, margin: "18px 0 30px" }}>
            {[
              ["Portfolio value", money(portfolio.totalholding?.totalholdingvalue)],
              ["Invested value", money(portfolio.totalholding?.totalinvvalue)],
              ["Total P&L", money(portfolio.totalholding?.totalprofitandloss)],
              ["P&L %", typeof portfolio.totalholding?.totalpnlpercentage === "number" ? `${portfolio.totalholding.totalpnlpercentage.toFixed(2)}%` : "—"],
            ].map(([label, value]) => (
              <article key={label} style={{ padding: 18, border: "1px solid #444", borderRadius: 12 }}>
                <p style={{ margin: 0, fontSize: 12, opacity: 0.65 }}>{label}</p>
                <strong style={{ display: "block", fontSize: 22, marginTop: 8 }}>{value}</strong>
              </article>
            ))}
          </section>

          <h2 style={{ fontSize: 22 }}>Equity holdings ({portfolio.holdings.length})</h2>
          <div style={{ overflowX: "auto", border: "1px solid #444", borderRadius: 10 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
              <thead><tr>{["Symbol", "Exchange", "Qty", "Avg. price", "LTP", "P&L", "P&L %"].map((x) => <th key={x} style={{ textAlign: "right", padding: 12, fontSize: 12, opacity: 0.7 }}>{x}</th>)}</tr></thead>
              <tbody>
                {portfolio.holdings.map((holding) => (
                  <tr key={`${holding.exchange}-${holding.tradingsymbol}`}>
                    <td style={{ padding: 12, textAlign: "left" }}>{holding.tradingsymbol}</td>
                    <td style={{ padding: 12, textAlign: "right" }}>{holding.exchange}</td>
                    <td style={{ padding: 12, textAlign: "right" }}>{holding.quantity}</td>
                    <td style={{ padding: 12, textAlign: "right" }}>{money(holding.averageprice)}</td>
                    <td style={{ padding: 12, textAlign: "right" }}>{money(holding.ltp)}</td>
                    <td style={{ padding: 12, textAlign: "right" }}>{money(holding.profitandloss)}</td>
                    <td style={{ padding: 12, textAlign: "right" }}>{holding.pnlpercentage.toFixed(2)}%</td>
                  </tr>
                ))}
                {portfolio.holdings.length === 0 && <tr><td colSpan={7} style={{ padding: 18, textAlign: "center" }}>No holdings returned.</td></tr>}
              </tbody>
            </table>
          </div>

          <h2 style={{ fontSize: 22, marginTop: 32 }}>Trading positions ({portfolio.positions.length})</h2>
          <div style={{ overflowX: "auto", border: "1px solid #444", borderRadius: 10 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
              <thead><tr>{["Symbol", "Exchange", "Product", "Net quantity", "Net price"].map((x) => <th key={x} style={{ textAlign: "left", padding: 12, fontSize: 12, opacity: 0.7 }}>{x}</th>)}</tr></thead>
              <tbody>
                {portfolio.positions.map((position, index) => (
                  <tr key={String(position.symboltoken ?? position.tradingsymbol ?? index)}>
                    <td style={{ padding: 12 }}>{String(position.tradingsymbol ?? "—")}</td>
                    <td style={{ padding: 12 }}>{String(position.exchange ?? "—")}</td>
                    <td style={{ padding: 12 }}>{String(position.producttype ?? "—")}</td>
                    <td style={{ padding: 12 }}>{String(position.netqty ?? "—")}</td>
                    <td style={{ padding: 12 }}>{String(position.netprice ?? "—")}</td>
                  </tr>
                ))}
                {portfolio.positions.length === 0 && <tr><td colSpan={5} style={{ padding: 18, textAlign: "center" }}>No open positions returned.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
