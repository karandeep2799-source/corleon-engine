"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import "./currency.css";

type Store = { id: string; name: string; slug: string; status: string };
type Wallet = { id: string; customerEmail: string; customerName: string | null; status: string; balance: number };
type Entry = { id: string; type: string; amount: number; reason: string; createdAt: string; store: { name: string } | null; wallet: { customerEmail: string; customerName: string | null } };
type Dashboard = { currency: { name: string; code: string; settlementCurrency: string }; stores: Store[]; wallets: Wallet[]; recentEntries: Entry[]; totals: { customers: number; outstandingCredits: number }; safeguards: Record<string, boolean> };

export default function CorleonCurrencyPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [storeName, setStoreName] = useState("");
  const [storeId, setStoreId] = useState("");
  const [action, setAction] = useState<"ISSUE" | "REDEEM">("ISSUE");
  const [email, setEmail] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [amount, setAmount] = useState("100");
  const [reason, setReason] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/currency", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to load Corleon Currency");
      setData(body as Dashboard);
      setStoreId((current) => current || body.stores?.[0]?.id || "");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load currency data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function createStore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    const response = await fetch("/api/currency/stores", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: storeName }),
    });
    const body = await response.json();
    if (!response.ok) { setNotice(body.error ?? "Store could not be created"); return; }
    setStoreName("");
    setStoreId(body.store.id);
    setNotice("Store created.");
    await refresh();
  }

  async function transact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    const numericAmount = Number(amount);
    if (!Number.isSafeInteger(numericAmount) || numericAmount <= 0) { setNotice("Enter a positive whole number of credits."); return; }
    if (!storeId) { setNotice("Create a store before issuing or redeeming credits."); return; }
    const response = await fetch("/api/currency/credits", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action, storeId, customerEmail: email, customerName: customerName || undefined,
        amount: numericAmount, reason, idempotencyKey: crypto.randomUUID(),
      }),
    });
    const body = await response.json();
    if (!response.ok) { setNotice(body.error ?? "Transaction failed"); return; }
    setNotice(action === "ISSUE" ? "Corleon credits issued." : "Corleon credits redeemed.");
    setAmount("100");
    setReason("");
    await refresh();
  }

  return (
    <main className="currency-shell">
      <header className="currency-header">
        <a href="/trade" className="currency-back">← Corleon Engine</a>
        <span className="currency-mode">CLOSED-LOOP CREDITS · TEST / INTERNAL</span>
      </header>
      <section className="currency-hero">
        <div>
          <p className="currency-eyebrow">CORLEON FINANCIAL · STORE NETWORK</p>
          <h1>Corleon <span>Currency</span></h1>
          <p className="currency-lede">Private rewards and usage credits across the stores you operate. INR remains the official payment and settlement currency.</p>
        </div>
        <div className="currency-coin">C<span>RL</span></div>
      </section>

      {error && <div className="currency-alert">{error}{error === "Authentication required" ? <a href="/trade">Sign in to Corleon Trade</a> : null}</div>}
      {notice && <div className="currency-notice" role="status">{notice}</div>}

      <section className="currency-stats">
        <article><span>CURRENCY UNIT</span><strong>CRL</strong><small>Private non-cash credits</small></article>
        <article><span>ACTIVE STORES</span><strong>{data?.stores.length ?? "—"}</strong><small>Across your store network</small></article>
        <article><span>CUSTOMER WALLETS</span><strong>{data?.totals.customers ?? "—"}</strong><small>Owner-scoped balances</small></article>
        <article><span>OUTSTANDING CREDITS</span><strong>{data?.totals.outstandingCredits.toLocaleString("en-IN") ?? "—"}</strong><small>CRL units, not INR value</small></article>
      </section>

      <section className="currency-grid">
        <article className="currency-panel">
          <div className="currency-panel-heading"><div><p className="currency-eyebrow">YOUR NETWORK</p><h2>Stores</h2></div><span>{data?.stores.length ?? 0} stores</span></div>
          <form className="currency-inline-form" onSubmit={createStore}>
            <input value={storeName} onChange={(event) => setStoreName(event.target.value)} placeholder="New store name" minLength={2} maxLength={80} required />
            <button type="submit">Add store</button>
          </form>
          <div className="currency-store-list">
            {data?.stores.map((store) => <button key={store.id} className={storeId === store.id ? "currency-store selected" : "currency-store"} onClick={() => setStoreId(store.id)}><span className="currency-store-mark">C</span><span><strong>{store.name}</strong><small>/{store.slug}</small></span><span className="currency-active">{store.status}</span></button>)}
            {!loading && !data?.stores.length && <p className="currency-empty">Create your first store to start issuing closed-loop credits.</p>}
          </div>
        </article>

        <article className="currency-panel">
          <div className="currency-panel-heading"><div><p className="currency-eyebrow">LEDGER ACTION</p><h2>Issue or redeem credits</h2></div><span className="currency-secure">OWNER ACCESS</span></div>
          <form className="currency-form" onSubmit={transact}>
            <label>Transaction<select value={action} onChange={(event) => setAction(event.target.value as "ISSUE" | "REDEEM")}><option value="ISSUE">Issue credits</option><option value="REDEEM">Redeem credits</option></select></label>
            <label>Store<select value={storeId} onChange={(event) => setStoreId(event.target.value)} required><option value="">Select a store</option>{data?.stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select></label>
            <label>Customer email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="customer@example.com" required maxLength={254} /></label>
            <label>Customer name <small>(optional)</small><input value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Customer name" maxLength={100} /></label>
            <div className="currency-form-row">
              <label>Amount (CRL)<input type="number" min="1" max="1000000" step="1" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label>
              <label>Reason<input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Welcome reward" minLength={3} maxLength={240} required /></label>
            </div>
            <button className="currency-primary" type="submit" disabled={!data?.stores.length}>{action === "ISSUE" ? "Issue Corleon credits" : "Redeem Corleon credits"}</button>
          </form>
          <p className="currency-form-foot">Every transaction is owner-authenticated, idempotent and recorded in the append-only ledger. Redemption cannot exceed the available balance.</p>
        </article>
      </section>

      <section className="currency-panel currency-ledger">
        <div className="currency-panel-heading"><div><p className="currency-eyebrow">AUDIT TRAIL</p><h2>Recent transactions</h2></div><button className="currency-refresh" onClick={() => void refresh()}>Refresh</button></div>
        <div className="currency-table-wrap"><table><thead><tr><th>Customer</th><th>Store</th><th>Activity</th><th>Reason</th><th>Amount</th><th>Date</th></tr></thead><tbody>
          {data?.recentEntries.map((entry) => <tr key={entry.id}><td><strong>{entry.wallet.customerName || entry.wallet.customerEmail}</strong><small>{entry.wallet.customerEmail}</small></td><td>{entry.store?.name ?? "—"}</td><td>{entry.type}</td><td>{entry.reason}</td><td className={entry.amount >= 0 ? "currency-positive" : "currency-negative"}>{entry.amount > 0 ? "+" : ""}{entry.amount.toLocaleString("en-IN")} CRL</td><td>{new Date(entry.createdAt).toLocaleString("en-IN")}</td></tr>)}
          {!loading && !data?.recentEntries.length && <tr><td colSpan={6} className="currency-empty">No transactions yet.</td></tr>}
        </tbody></table></div>
      </section>

      <section className="currency-compliance">
        <div><p className="currency-eyebrow">REGULATORY BOUNDARIES</p><h2>Credits are not money.</h2><p>CRL is configured as a closed-loop promotional / usage credit ledger. It has no INR peg, cash-out, peer transfer, external exchange, or blockchain transfer. Customers pay merchants separately in INR through an eligible regulated payment provider. Do not market CRL as legal tender, a deposit, an investment, or a redeemable monetary balance.</p></div>
        <ul><li>INR is the settlement currency</li><li>Store-owner scoped customer wallets</li><li>Immutable transaction history</li><li>Balance checks inside serializable transactions</li><li>Idempotency protection against duplicate writes</li><li>Cash redemption and transfers disabled</li></ul>
      </section>
      <footer className="currency-footer">CORLEON ENGINE · CORLEON CURRENCY · {loading ? "SYNCING" : "CONNECTED TO YOUR PRIVATE LEDGER"}</footer>
    </main>
  );
}
