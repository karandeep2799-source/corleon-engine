import { Button, Card } from '@corleon/ui';

const capabilities = [
  ['AI orchestration', 'Route model workloads through governed provider and tool policies.'],
  ['Connected systems', 'Bring APIs, payments, webhooks, and external services behind one application boundary.'],
  ['Data foundation', 'Use PostgreSQL and Prisma for durable application state when DATABASE_URL is configured.'],
  ['Operational control', 'Use health endpoints, typed workspace checks, and Vercel-native deployments to keep the platform observable.'],
];

export default function Home() {
  return (
    <main className="shell">
      <nav className="nav">
        <strong>Corleon Engine</strong>
        <div style={{display:"flex",gap:18}}><a href="/swap">Corleon Swap</a><a href="/api/health">API health</a></div>
      </nav>

      <section className="hero">
        <p className="eyebrow">GOVERNED AI PLATFORM</p>
        <h1>One production surface for your AI systems.</h1>
        <p className="lede">
          Corleon Engine brings AI orchestration, integrations, data services, and operational controls
          together in one independently deployable application.
        </p>
        <div className="actions">
          <a href="/api/health"><Button>Check platform health</Button></a>
          <a className="secondary" href="#architecture">Explore architecture</a>
        </div>
      </section>

      <section className="grid" id="architecture">
        {capabilities.map(([title, description]) => (
          <Card key={title}>
            <p className="eyebrow">CORLEON ENGINE</p>
            <h2>{title}</h2>
            <p>{description}</p>
          </Card>
        ))}
      </section>

      <section className="status">
        <div>
          <p className="eyebrow">DEPLOYMENT FOUNDATION</p>
          <h2>Next.js 16 + Turborepo</h2>
          <p>Vercel builds the web workspace while the repository root retains the existing API, Prisma, AI, and integration services.</p>
        </div>
        <pre>{`GitHub → Vercel
        ↓
pnpm install (Corepack)
        ↓
turbo build --filter=@corleon/web
        ↓
Next.js 16
        ↓
Corleon Engine`}</pre>
      </section>

      <footer className="status">
        <p>Financial execution is separately governed and remains disabled by default. This public surface does not expose live trading or payment controls.</p>
      </footer>
    </main>
  );
}
