import { Button, Card } from '@corleon/ui';

const capabilities = [
  ['Multi-market trading', 'A unified workspace for US equities, NSE/BSE, crypto, forex and commodities.'],
  ['AI investment intelligence', 'Connect research, thesis tracking, portfolio analysis and risk signals.'],
  ['Secure execution boundary', 'Broker adapters, per-market permissions, pre-trade controls and immutable audit history.'],
  ['Production foundation', 'Next.js 16, PostgreSQL, Prisma, Vercel and independently testable provider adapters.'],
];

export default function Home() {
  return (
    <main className="shell">
      <nav className="nav">
        <strong>Corleon Engine</strong>
        <a href="/api/health">API health</a>
      </nav>
      <section className="hero">
        <p className="eyebrow">CORLEON FINANCIAL</p>
        <h1>One workspace for every market.</h1>
        <p className="lede">
          Corleon Trade brings portfolio visibility, market research, risk controls and broker integrations
          into the Corleon Engine platform.
        </p>
        <div className="actions">
          <a href="/trade"><Button>Open Corleon Trade</Button></a>
          <a className="secondary" href="#architecture">View architecture</a>
        </div>
      </section>
      <section className="grid" id="architecture">
        {capabilities.map(([title, description]) => (
          <Card key={title}>
            <p className="eyebrow">CORLEON TRADE</p>
            <h2>{title}</h2>
            <p>{description}</p>
          </Card>
        ))}
      </section>
      <section className="status">
        <div>
          <p className="eyebrow">EXECUTION SAFETY</p>
          <h2>Live trading stays locked until certified.</h2>
          <p>Market access is enabled only after a supported broker, market-data entitlement, risk policy and jurisdictional checks are configured.</p>
        </div>
        <pre>{`Next.js 16 + TypeScript
        ↓
Prisma + PostgreSQL
        ↓
Broker adapter boundary
        ↓
Pre-trade risk + audit
        ↓
Authorized execution only`}</pre>
      </section>
    </main>
  );
}
