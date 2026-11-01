import { Button, Card } from '@corleon/ui';

const capabilities = [
  ['Model routing', 'Route AI workloads through the provider and policy layer you choose.'],
  ['Integrations', 'Keep external APIs, payments, webhooks, and services behind one application boundary.'],
  ['Data layer', 'Use PostgreSQL and Prisma for durable application state when DATABASE_URL is configured.'],
  ['Operations', 'Health endpoints and Vercel-native deployment make the engine observable and easy to ship.'],
];

export default function Home() {
  return (
    <main className="shell">
      <nav className="nav">
        <strong>Corleon Engine</strong>
        <a href="/api/health">API health</a>
      </nav>

      <section className="hero">
        <p className="eyebrow">STANDALONE AI PLATFORM</p>
        <h1>One production surface for your AI systems.</h1>
        <p className="lede">
          Corleon Engine combines the web application, API boundary, shared UI, integrations, and production
          deployment foundation in one independently deployable Next.js application.
        </p>
        <div className="actions">
          <a href="/api/health"><Button>Check health</Button></a>
          <a className="secondary" href="#architecture">View architecture</a>
        </div>
      </section>

      <section className="grid" id="architecture">
        {capabilities.map(([title, description]) => (
          <Card key={title}>
            <p className="eyebrow">CORLEON</p>
            <h2>{title}</h2>
            <p>{description}</p>
          </Card>
        ))}
      </section>

      <section className="status">
        <div>
          <p className="eyebrow">DEPLOYMENT MODEL</p>
          <h2>Standalone + Turborepo</h2>
          <p>Vercel builds only <code>@corleon/web</code>, while Turborepo tracks workspace dependencies and caches unchanged work.</p>
        </div>
        <pre>{`GitHub → Vercel
        ↓
turbo build --filter=@corleon/web
        ↓
Next.js standalone
        ↓
Corleon Engine`}</pre>
      </section>
    </main>
  );
}
