"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { formatINR, summarize, transactionsToCsv, type Transaction } from "../../lib/finance-engine";

export default function CreditCardsApp() {
  const [token, setToken] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<Transaction[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const summary = useMemo(() => summarize(rows), [rows]);
  function exportCsv() {
    const blob = new Blob([transactionsToCsv(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = "corleon-credit-card-transactions.csv"; link.click();
    URL.revokeObjectURL(url);
  }
  async function upload() {
    if (!file || !token || !name.trim()) { setError("Add your access token, cardholder name and PDF statement."); return; }
    if (file.size > 4 * 1024 * 1024) { setError("Choose a PDF smaller than 4 MB for the web upload route."); return; }
    setBusy(true); setError("");
    try {
      const data = new FormData();
      data.set("statement", file); data.set("cardholderName", name); data.set("pdfPassword", password);
      const response = await fetch("/api/finance/parse", { method: "POST", headers: { authorization: `Bearer ${token}` }, body: data });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Unable to parse statement.");
      const parsed = payload.transactions as Array<{id?:string;date:string;description:string;amountPaise?:number;amount?:number;rewardPoints?:number;category?:string}>;
      setRows(parsed.map((r,i)=>({id:r.id??String(i),date:new Date(r.date).toISOString(),description:r.description,amountPaise:r.amountPaise??Math.round((r.amount??0)*100),rewardPoints:r.rewardPoints??0,category:r.category??"Uncategorized"})));
      setPassword("");
    } catch (e) { setError(e instanceof Error ? e.message : "Unexpected error."); }
    finally { setBusy(false); }
  }
  return <main className="finance-shell">
    <nav className="finance-nav"><Link href="/">← Corleon Engine</Link><span>PRIVATE FINANCE WORKSPACE</span></nav>
    <header className="finance-hero"><p className="finance-kicker">CORLEON · PERSONAL FINANCE</p><h1>Credit card clarity.</h1><p>Understand spending, refunds, rewards and monthly patterns from your own statements. Your PDFs are processed on request, not used to connect to your bank.</p></header>
    <section className="finance-panel">
      <h2>Import an HDFC statement</h2><p>PDF only · up to 4 MB · password is forwarded only to the configured parser and cleared from the form after success.</p>
      <label>Finance access token<input type="password" autoComplete="off" value={token} onChange={e=>setToken(e.target.value)} placeholder="Provided by your administrator"/></label>
      <label>Cardholder name<input value={name} onChange={e=>setName(e.target.value)} placeholder="As printed on statement"/></label>
      <label>PDF statement<input type="file" accept="application/pdf,.pdf" onChange={e=>setFile(e.target.files?.[0]??null)}/></label>
      <label>PDF password (if protected)<input type="password" autoComplete="off" value={password} onChange={e=>setPassword(e.target.value)}/></label>
      <button disabled={busy||!file} onClick={upload}>{busy?"Processing statement…":"Parse statement"}</button>
      {error&&<p role="alert" className="finance-error">{error}</p>}
      <small>Never upload statements belonging to someone else without their permission. Do not share your access token.</small>
    </section>
    <section className="finance-results"><div className="finance-section-head"><div><p className="finance-kicker">YOUR STATEMENT DATA</p><h2>Spending overview</h2></div><span>{rows.length} transactions</span></div>
      {rows.length===0?<div className="finance-empty">Your analytics will appear here after a successful import.</div>:<>
        <div className="finance-metrics"><article><span>Total spend</span><strong>{formatINR(summary.totalSpendPaise)}</strong></article><article><span>Refunds & credits</span><strong>{formatINR(summary.totalCreditsPaise)}</strong></article><article><span>Net spend</span><strong>{formatINR(summary.netSpendPaise)}</strong></article><article><span>Reward points</span><strong>{summary.totalRewardPoints.toLocaleString("en-IN")}</strong></article></div>
        <button className="finance-export" onClick={exportCsv}>Export transactions CSV</button><h3>Monthly activity</h3>{summary.monthly.map(m=><div className="finance-month" key={m.month}><strong>{m.month}</strong><span>{m.transactionCount} items</span><b>{formatINR(m.netSpendPaise)}</b></div>)}
        <h3>Categories</h3>{Object.entries(summary.categoryTotals).sort((a,b)=>b[1]-a[1]).map(([cat,value])=><div className="finance-month" key={cat}><strong>{cat}</strong><b>{formatINR(value)}</b></div>)}
      </>}
    </section>
  </main>;
}
