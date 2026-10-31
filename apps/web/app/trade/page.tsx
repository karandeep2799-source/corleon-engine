'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import './trade.css';

type User = { id: string; email: string; name: string | null; image: string | null };
type Market = { id: string; label: string; currency: string; connected: boolean; marketData: string; liveExecution: string };
type OrderRow = { id: string; market: string; symbol: string; side: string; orderType: string; quantity: string; limitPrice: string | null; status: string; createdAt: string };

const marketOptions = [
  { id: 'US_STOCKS', label: 'US stocks', code: 'US' },
  { id: 'INDIAN_EQUITIES', label: 'NSE / BSE', code: 'IN' },
  { id: 'CRYPTO', label: 'Crypto', code: 'CR' },
  { id: 'FOREX', label: 'Forex', code: 'FX' },
  { id: 'COMMODITIES', label: 'Commodities', code: 'CM' },
] as const;

function LoginGate({ onLogin }: { onLogin: (user: User) => void }) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  return (
    <div className="trade-login">
      <div className="trade-login-card">
        <div className="trade-brand-mark">C</div>
        <p className="trade-kicker">CORLEON FINANCIAL</p>
        <h1>Trade with clarity.</h1>
        <p className="trade-muted">Sign in to access your private multi-market trading workspace.</p>
        {clientId ? (
          <GoogleOAuthProvider clientId={clientId}>
            <GoogleLogin
              onSuccess={async (response) => {
                if (!response.credential) return;
                const result = await fetch('/api/auth/google', {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ credential: response.credential }),
                });
                const data = await result.json();
                if (result.ok && data.user) onLogin(data.user as User);
              }}
              onError={() => window.alert('Google sign-in failed. Please try again.')}
              theme="filled_black"
              shape="pill"
            />
          </GoogleOAuthProvider>
        ) : (
          <div className="trade-setup-note">
            Google sign-in is not configured yet. Set <code>GOOGLE_CLIENT_ID</code> and <code>NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> in Vercel.
          </div>
        )}
        <p className="trade-fineprint">Secure session · Private account · Live execution disabled until a broker is certified</p>
      </div>
    </div>
  );
}

function Terminal({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [activeMarket, setActiveMarket] = useState<string>('US_STOCKS');
  const [markets, setMarkets] = useState<Market[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loadingMarkets, setLoadingMarkets] = useState(true);
  const [symbol, setSymbol] = useState('COIN');
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [quantity, setQuantity] = useState('1');
  const [limitPrice, setLimitPrice] = useState('');
  const [notice, setNotice] = useState('');

  const refreshMarkets = useCallback(async () => {
    setLoadingMarkets(true);
    try {
      const response = await fetch('/api/markets', { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        setMarkets(data.markets ?? []);
      }
      const historyResponse = await fetch('/api/trading/history', { cache: 'no-store' });
      if (historyResponse.ok) {
        const history = await historyResponse.json();
        setOrders(history.orders ?? []);
      }
    } finally {
      setLoadingMarkets(false);
    }
  }, []);

  useEffect(() => { void refreshMarkets(); }, [refreshMarkets]);

  const active = useMemo(() => markets.find((m) => m.id === activeMarket), [markets, activeMarket]);
  const marketLabel = marketOptions.find((m) => m.id === activeMarket)?.label ?? 'Market';

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice('Live order submission is locked until a certified broker adapter, account, and risk policy are configured.');
  }

  return (
    <main className="trade-app">
      <aside className="trade-sidebar">
        <a className="trade-logo" href="/trade"><span className="trade-brand-mark small">C</span><span>corleon<span className="trade-logo-light">trade</span></span></a>
        <div className="trade-sidebar-label">WORKSPACE</div>
        <a className="trade-side-link active" href="#overview"><span>◫</span> Overview</a>
        <a className="trade-side-link" href="#markets"><span>⌁</span> Markets</a>
        <a className="trade-side-link" href="#portfolio"><span>▤</span> Portfolio</a>
        <a className="trade-side-link" href="#orders"><span>⇄</span> Orders</a>
        <a className="trade-side-link" href="/currency"><span>◉</span> Corleon Currency</a>
        <a className="trade-side-link" href="#risk"><span>◇</span> Risk controls</a>
        <div className="trade-sidebar-label">MARKETS</div>
        {marketOptions.map((market) => (
          <button className={activeMarket === market.id ? 'trade-market-link selected' : 'trade-market-link'} key={market.id} onClick={() => setActiveMarket(market.id)}>
            <span className="trade-market-code">{market.code}</span>{market.label}
          </button>
        ))}
        <div className="trade-sidebar-bottom">
          <div className="trade-status-dot" /> <span>Execution locked</span>
          <small>Safety-first mode</small>
        </div>
      </aside>

      <section className="trade-main">
        <header className="trade-topbar">
          <div><span className="trade-breadcrumb">Workspace</span><span className="trade-breadcrumb-sep">/</span><strong>Overview</strong></div>
          <div className="trade-user">
            {user.image ? <img src={user.image} alt="" /> : <span className="trade-avatar">{(user.name ?? user.email).slice(0,1).toUpperCase()}</span>}
            <span>{user.name ?? user.email}</span>
            <button onClick={onLogout}>Sign out</button>
          </div>
        </header>

        <div className="trade-content">
          <section className="trade-heading" id="overview">
            <div><p className="trade-kicker">SATURDAY, OCTOBER 31, 2026</p><h1>Good morning, {user.name?.split(' ')[0] ?? 'Trader'}.</h1><p className="trade-muted">Your global markets workspace, all in one place.</p></div>
            <div className="trade-live-pill"><span /> LIVE EXECUTION LOCKED</div>
          </section>

          <section className="trade-metric-grid" id="portfolio">
            <article className="trade-metric-card primary">
              <div className="trade-metric-top"><span>PORTFOLIO VALUE</span><span className="trade-card-icon">◈</span></div>
              <div className="trade-metric-value">— <small>USD</small></div>
              <div className="trade-metric-foot">Connect a broker to sync balances and positions</div>
            </article>
            <article className="trade-metric-card">
              <div className="trade-metric-top"><span>DAY P&amp;L</span><span className="trade-card-icon">↗</span></div>
              <div className="trade-metric-value">—</div>
              <div className="trade-metric-foot">Awaiting verified account data</div>
            </article>
            <article className="trade-metric-card">
              <div className="trade-metric-top"><span>OPEN POSITIONS</span><span className="trade-card-icon">▤</span></div>
              <div className="trade-metric-value">—</div>
              <div className="trade-metric-foot">No broker positions synchronized</div>
            </article>
            <article className="trade-metric-card">
              <div className="trade-metric-top"><span>CONNECTED MARKETS</span><span className="trade-card-icon">⌁</span></div>
              <div className="trade-metric-value">{markets.filter((m) => m.connected).length}<small> / 5</small></div>
              <div className="trade-metric-foot">Broker connections required</div>
            </article>
          </section>

          <section className="trade-two-col">
            <article className="trade-panel market-panel" id="markets">
              <div className="trade-panel-heading"><div><p className="trade-kicker">MARKET OVERVIEW</p><h2>{marketLabel}</h2></div><span className="trade-unavailable-tag">DATA NOT CONNECTED</span></div>
              <div className="trade-tabs">
                {marketOptions.map((market) => <button key={market.id} className={activeMarket === market.id ? 'active' : ''} onClick={() => setActiveMarket(market.id)}>{market.label}</button>)}
              </div>
              <div className="trade-chart-empty">
                <div className="trade-chart-symbol">⌁</div>
                <strong>Live market feed not configured</strong>
                <p>Connect a licensed market-data provider to load verified quotes, charts, depth and exchange status.</p>
              </div>
              <div className="trade-panel-foot"><span>{active?.currency ?? '—'} base currency</span><span>{loadingMarkets ? 'Checking providers…' : 'No quote source connected'}</span></div>
            </article>

            <article className="trade-panel order-panel" id="order-ticket">
              <div className="trade-panel-heading"><div><p className="trade-kicker">ORDER TICKET</p><h2>Place an order</h2></div><span className="trade-lock-icon">▣</span></div>
              <div className="trade-order-warning"><strong>Live trading is locked</strong><span>No order can be routed until your broker is connected, validated and approved.</span></div>
              <form onSubmit={submitOrder}>
                <label>Market<select value={activeMarket} onChange={(e) => setActiveMarket(e.target.value)}>{marketOptions.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select></label>
                <label>Instrument<input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} maxLength={32} /></label>
                <div className="trade-side-switch"><button type="button" className={side === 'BUY' ? 'buy selected' : 'buy'} onClick={() => setSide('BUY')}>Buy</button><button type="button" className={side === 'SELL' ? 'sell selected' : 'sell'} onClick={() => setSide('SELL')}>Sell</button></div>
                <div className="trade-input-row"><label>Quantity<input inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></label><label>Limit price<input inputMode="decimal" placeholder="0.00" value={limitPrice} onChange={(e) => setLimitPrice(e.target.value)} /></label></div>
                <button className="trade-submit" type="submit" disabled>Connect broker to trade</button>
                {notice && <p className="trade-notice" role="status">{notice}</p>}
              </form>
              <p className="trade-panel-disclaimer">Order preview only. No funds are accessed and no orders are transmitted.</p>
            </article>
          </section>

          <section className="trade-panel trade-history-panel" id="orders">
            <div className="trade-panel-heading"><div><p className="trade-kicker">ACTIVITY</p><h2>Recent orders</h2></div><span className="trade-card-icon">⇄</span></div>
            {orders.length === 0 ? (
              <div className="trade-history-empty">No orders yet. Broker order history will appear here after a supported account is connected and synchronized.</div>
            ) : (
              <div className="trade-history-scroll"><table className="trade-history-table"><thead><tr><th>Instrument</th><th>Market</th><th>Side</th><th>Type</th><th>Quantity</th><th>Status</th><th>Created</th></tr></thead><tbody>
                {orders.map((order) => <tr key={order.id}><td><strong>{order.symbol}</strong></td><td>{order.market.replaceAll('_', ' ')}</td><td className={order.side === 'BUY' ? 'positive' : 'negative'}>{order.side}</td><td>{order.orderType}</td><td>{order.quantity}</td><td><span className="trade-order-status">{order.status}</span></td><td>{new Date(order.createdAt).toLocaleString()}</td></tr>)}
              </tbody></table></div>
            )}
          </section>

          <section className="trade-bottom-grid">
            <article className="trade-panel" id="risk">
              <div className="trade-panel-heading"><div><p className="trade-kicker">CAPITAL PROTECTION</p><h2>Risk controls</h2></div><span className="trade-shield">◇</span></div>
              <div className="trade-risk-row"><span>Global execution kill switch</span><strong className="trade-risk-off">ON · BLOCKING</strong></div>
              <div className="trade-risk-row"><span>Market orders</span><strong>Restricted by default</strong></div>
              <div className="trade-risk-row"><span>Per-market notional limits</span><strong>Not configured</strong></div>
              <div className="trade-risk-row"><span>Broker reconciliation</span><strong>Not connected</strong></div>
            </article>
            <article className="trade-panel">
              <div className="trade-panel-heading"><div><p className="trade-kicker">ACCOUNT READINESS</p><h2>Connect your markets</h2></div><span className="trade-card-icon">⌘</span></div>
              <div className="trade-connection-list">
                {marketOptions.map((m) => {
                  const connected = markets.find((x) => x.id === m.id)?.connected;
                  return <div className="trade-connection-row" key={m.id}><span className="trade-market-code">{m.code}</span><span>{m.label}</span><strong className={connected ? 'connected' : ''}>{connected ? 'Connected' : 'Setup required'}</strong></div>;
                })}
              </div>
              <button className="trade-secondary-button" onClick={() => setNotice('Broker onboarding is not enabled yet. Provider selection and compliance checks are required before live execution.')}>View integration requirements</button>
            </article>
          </section>

          <footer className="trade-footer"><span>Corleon Trade · Private multi-market workspace</span><span>Market data: not connected · Execution: disabled · All times UTC</span></footer>
        </div>
      </section>
    </main>
  );
}

export default function TradePage() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);

  const loadSession = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/session', { cache: 'no-store' });
      const data = await response.json();
      setUser(data.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => { void loadSession(); }, [loadSession]);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
  }

  if (checking) return <div className="trade-loading">Loading Corleon Trade…</div>;
  if (!user) return <LoginGate onLogin={setUser} />;
  return <Terminal user={user} onLogout={() => void logout()} />;
}
