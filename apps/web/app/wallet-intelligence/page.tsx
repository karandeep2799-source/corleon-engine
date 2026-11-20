"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import styles from "./wallet-intelligence.module.css";

type Chain = { id: string; name: string; explorerUrl: string | null; nativeCurrencySymbol: string | null };
type Token = { address: string; name: string; symbol: string; decimals: number; balance: string; valueUsd: string | null };
type ChainPortfolio = { chain: Chain; nativeBalance: string | null; transactionCount: number | null; tokens: Token[]; error?: string };
type Portfolio = { generatedAt: string; supportedChainCount: number; queriedChainCount: number; chains: ChainPortfolio[]; totals: { chainsWithActivity: number; tokenCount: number; transactionCount: number }; readOnly: true };
const DEFAULT_CHAIN_IDS = ["1", "10", "8453", "42161", "100", "137"];

function formatUnits(raw: string | null, decimals = 18): string {
  if (raw === null) return "—";
  try {
    const value = BigInt(raw);
    const places = Math.min(36, Math.max(0, decimals));
    const divisor = 10n ** BigInt(places);
    const whole = value / divisor;
    const fraction = (value % divisor).toString().padStart(places, "0").slice(0, 5).replace(/0+$/, "");
    return fraction ? whole.toLocaleString() + "." + fraction : whole.toLocaleString();
  } catch { return "—"; }
}

export default function WalletIntelligencePage() {
  const [chains, setChains] = useState<Chain[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>(DEFAULT_CHAIN_IDS);
  const [address, setAddress] = useState("");
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [loadingChains, setLoadingChains] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/integrations/blockscout/chains")
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Could not load supported networks.");
        if (active) {
          const items = (payload.chains ?? []) as Chain[];
          setChains(items);
          setSelectedIds((current) => current.filter((id) => items.some((chain) => chain.id === id)));
        }
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Network registry unavailable."); })
      .finally(() => { if (active) setLoadingChains(false); });
    return () => { active = false; };
  }, []);

  const selectedCount = selectedIds.length;
  const selectedNames = useMemo(() => selectedIds.map((id) => chains.find((chain) => chain.id === id)?.name ?? id), [chains, selectedIds]);

  function toggleChain(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : current.length >= 6 ? current : [...current, id]);
  }

  async function scan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setPortfolio(null);
    if (!address.trim()) { setError("Enter a public EVM wallet address to scan."); return; }
    if (!selectedIds.length) { setError("Select at least one network."); return; }
    setLoading(true);
    try {
      const response = await fetch("/api/integrations/blockscout/portfolio", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: address.trim(), chainIds: selectedIds }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Portfolio scan failed.");
      setPortfolio(payload as Portfolio);
      if (payload.chains?.some((item: ChainPortfolio) => item.error)) setNotice("Some networks could not be queried. Review the individual network messages below.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Portfolio scan failed."); }
    finally { setLoading(false); }
  }

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <a href="/" className={styles.brand}>CORLEON ENGINE</a>
        <span className={styles.readOnly}>READ-ONLY INTELLIGENCE</span>
      </header>
      <section className={styles.hero}>
        <p className={styles.kicker}>BLOCKCHAIN DATA · MULTI-CHAIN</p>
        <h1>Wallet intelligence, without wallet custody.</h1>
        <p className={styles.lede}>Inspect public EVM wallet balances, token holdings and explorer-indexed activity through Blockscout. No wallet connection or transaction signing is required.</p>
      </section>
      <section className={styles.panel}>
        <form onSubmit={scan}>
          <label className={styles.label} htmlFor="wallet-address">Public wallet address</label>
          <div className={styles.searchRow}>
            <input id="wallet-address" className={styles.addressInput} value={address} onChange={(event) => setAddress(event.target.value)} placeholder="0x…" autoComplete="off" spellCheck={false} />
            <button className={styles.scanButton} disabled={loading || loadingChains}>{loading ? "Scanning…" : "Scan wallet"}</button>
          </div>
          <div className={styles.networkHeader}>
            <div><span className={styles.label}>Networks</span><p className={styles.helper}>{selectedCount} of 6 selected · {chains.length} supported mainnets discovered</p></div>
            <span className={styles.helper}>Read-only · public address data</span>
          </div>
          {loadingChains ? <p className={styles.helper}>Loading Blockscout network registry…</p> : (
            <div className={styles.networks}>
              {chains.map((chain) => (
                <label key={chain.id} className={styles.networkOption}>
                  <input type="checkbox" checked={selectedIds.includes(chain.id)} disabled={!selectedIds.includes(chain.id) && selectedIds.length >= 6} onChange={() => toggleChain(chain.id)} />
                  <span>{chain.name}</span><small>{chain.id}</small>
                </label>
              ))}
            </div>
          )}
        </form>
        {error && <p className={styles.error} role="alert">{error}</p>}
        {notice && <p className={styles.notice} role="status">{notice}</p>}
      </section>
      {loading && <p className={styles.loading} aria-live="polite">Querying selected networks through the Blockscout PRO API…</p>}
      {portfolio && (
        <section className={styles.results}>
          <div className={styles.summaryGrid}>
            <article className={styles.metric}><span>Networks scanned</span><strong>{portfolio.queriedChainCount}</strong></article>
            <article className={styles.metric}><span>Networks with activity</span><strong>{portfolio.totals.chainsWithActivity}</strong></article>
            <article className={styles.metric}><span>Token holdings</span><strong>{portfolio.totals.tokenCount}</strong></article>
            <article className={styles.metric}><span>Explorer transactions</span><strong>{portfolio.totals.transactionCount.toLocaleString()}</strong></article>
          </div>
          <div className={styles.sectionHeading}>
            <div><p className={styles.kicker}>PORTFOLIO SNAPSHOT</p><h2>Network breakdown</h2></div>
            <span className={styles.helper}>Updated {new Date(portfolio.generatedAt).toLocaleString()}</span>
          </div>
          <div className={styles.chainGrid}>
            {portfolio.chains.map((item) => (
              <article key={item.chain.id} className={styles.chainCard}>
                <div className={styles.chainTop}>
                  <div><h3>{item.chain.name}</h3><span>Chain ID {item.chain.id}</span></div>
                  {item.chain.explorerUrl && <a href={item.chain.explorerUrl} target="_blank" rel="noreferrer">Explorer ↗</a>}
                </div>
                {item.error ? <p className={styles.chainError}>{item.error}</p> : (
                  <>
                    <div className={styles.balance}><strong>{formatUnits(item.nativeBalance)}</strong><span>{item.chain.nativeCurrencySymbol ?? "Native asset"}</span></div>
                    <p className={styles.helper}>{item.transactionCount ?? "—"} indexed transactions</p>
                    <div className={styles.tokenList}>
                      {item.tokens.length ? item.tokens.slice(0, 8).map((token, index) => (
                        <div className={styles.tokenRow} key={token.address || index}>
                          <span><b>{token.symbol}</b><small>{token.name}</small></span><strong>{formatUnits(token.balance, token.decimals)}</strong>
                        </div>
                      )) : <p className={styles.helper}>No token holdings returned by the explorer.</p>}
                    </div>
                  </>
                )}
              </article>
            ))}
          </div>
          <p className={styles.disclaimer}>Explorer-indexed data can lag the underlying chain. Token balances are not a valuation, liquidity guarantee, tax statement or investment recommendation.</p>
        </section>
      )}
      <footer className={styles.footer}>
        <span>Corleon Blockchain Intelligence</span><span>No private keys · No signatures · No transfers · No swaps</span>
      </footer>
    </main>
  );
}
