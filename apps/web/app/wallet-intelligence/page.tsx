'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type ChainResult = {
  chain: { id: string; name: string; nativeCurrency?: string };
  nativeBalance: string | null;
  nativeSymbol: string;
  transactionCount: number | null;
  tokens: Array<{ address: string; name: string; symbol: string; decimals: number; balance: string; valueUsd: string | null }>;
  error?: string;
};
type Portfolio = { address: string; generatedAt: string; supportedChainCount: number; queriedChainCount: number; chains: ChainResult[]; totals: { chainsWithActivity: number; tokenCount: number; transactionCount: number }; readOnly: boolean };

const DEFAULT_ADDRESS = '0xd6eCCeBC1a33f10b432cd5896554182411D840dF';

function formatBalance(raw: string | null, decimals = 18) {
  if (raw === null) return '—';
  try {
    const value = BigInt(raw);
    const whole = value / 10n ** BigInt(decimals);
    const fraction = (value % 10n ** BigInt(decimals)).toString().padStart(decimals, '0').slice(0, 5).replace(/0+$/, '');
    return fraction ? `${whole}.${fraction}` : whole.toString();
  } catch { return raw; }
}

export default function WalletIntelligencePage() {
  const [address, setAddress] = useState(DEFAULT_ADDRESS);
  const [data, setData] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch(`/api/integrations/blockscout/portfolio?address=${encodeURIComponent(address)}`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Could not load wallet data');
      setData(payload);
    } catch (err) { setError(err instanceof Error ? err.message : 'Request failed'); }
    finally { setLoading(false); }
  }, [address]);

  useEffect(() => { void load(); }, [load]);
  const visibleChains = useMemo(() => (data?.chains || []).filter(item => item.chain.name.toLowerCase().includes(filter.toLowerCase())), [data, filter]);

  return (
    <main style={{ maxWidth: 1120, margin: '0 auto', padding: '36px 20px 72px', color: '#111827' }}>
      <nav style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 36 }}>
        <a href="/" style={{ fontWeight: 800 }}>← Corleon Engine</a>
        <span style={{ color: '#16845b', fontSize: 13, fontWeight: 700 }}>READ-ONLY MODE</span>
      </nav>
      <p style={{ letterSpacing: 2, fontSize: 11, fontWeight: 800, opacity: .55 }}>CORLEON · BLOCKCHAIN INTELLIGENCE</p>
      <h1 style={{ fontSize: 'clamp(34px, 6vw, 58px)', letterSpacing: -2, margin: '8px 0' }}>Wallet Intelligence</h1>
      <p style={{ color: '#667085', maxWidth: 720 }}>Explore native balances, token holdings and activity across Blockscout-supported EVM networks. This dashboard cannot sign or submit transactions.</p>

      <form onSubmit={event => { event.preventDefault(); void load(); }} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '28px 0' }}>
        <input aria-label="Wallet address" value={address} onChange={event => setAddress(event.target.value)} spellCheck={false} style={{ flex: '1 1 420px', minWidth: 0, padding: 14, border: '1px solid #d0d5dd', borderRadius: 10, fontFamily: 'monospace' }} />
        <button disabled={loading} style={{ padding: '0 22px', border: 0, borderRadius: 10, background: '#111827', color: 'white', fontWeight: 700 }}>{loading ? 'Scanning…' : 'Refresh portfolio'}</button>
      </form>

      {error && <p role="alert" style={{ padding: 14, background: '#fff1f0', borderRadius: 10, color: '#b42318' }}>{error}</p>}
      {loading && <p aria-live="polite">Scanning supported networks in safe batches. This may take a moment.</p>}
      {data && <>
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, margin: '24px 0' }}>
          {[
            ['Networks scanned', `${data.queriedChainCount} / ${data.supportedChainCount}`],
            ['Networks with activity', String(data.totals.chainsWithActivity)],
            ['Token holdings', String(data.totals.tokenCount)],
            ['Transactions indexed', data.totals.transactionCount.toLocaleString()],
          ].map(([label, value]) => <div key={label} style={{ padding: 18, border: '1px solid #eaecf0', borderRadius: 14 }}><div style={{ color: '#667085', fontSize: 13 }}>{label}</div><strong style={{ display: 'block', fontSize: 26, marginTop: 8 }}>{value}</strong></div>)}
        </section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', margin: '32px 0 14px' }}>
          <h2 style={{ margin: 0 }}>Network breakdown</h2>
          <input aria-label="Filter networks" placeholder="Filter networks…" value={filter} onChange={event => setFilter(event.target.value)} style={{ padding: 10, border: '1px solid #d0d5dd', borderRadius: 9 }} />
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          {visibleChains.map(item => <article key={item.chain.id} style={{ border: '1px solid #eaecf0', borderRadius: 14, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div><strong>{item.chain.name}</strong><div style={{ fontSize: 12, color: '#667085' }}>Chain ID {item.chain.id}</div></div>
              <div style={{ textAlign: 'right' }}><strong>{formatBalance(item.nativeBalance)} {item.nativeSymbol}</strong><div style={{ fontSize: 12, color: '#667085' }}>{item.transactionCount ?? '—'} transactions</div></div>
            </div>
            {item.error && <p style={{ color: '#b54708', marginBottom: 0, fontSize: 13 }}>{item.error}</p>}
            {item.tokens.length > 0 && <div style={{ marginTop: 14, borderTop: '1px solid #f2f4f7', paddingTop: 12 }}>{item.tokens.slice(0, 8).map((token, index) => <div key={token.address || index} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '5px 0', fontSize: 13 }}><span>{token.name} <span style={{ color: '#667085' }}>({token.symbol})</span></span><span>{formatBalance(token.balance, token.decimals)}</span></div>)}</div>}
          </article>)}
        </div>
        <p style={{ color: '#667085', fontSize: 12, marginTop: 20 }}>Last refreshed {new Date(data.generatedAt).toLocaleString()} · Explorer-indexed data may lag the chain. Token balances are not a valuation or a guarantee of liquidity.</p>
      </>}
      <footer style={{ marginTop: 42, paddingTop: 18, borderTop: '1px solid #eaecf0', color: '#667085', fontSize: 12 }}>Security boundary: no wallet connection, private-key storage, transaction signing, token approvals, swaps or transfers are implemented.</footer>
    </main>
  );
}
