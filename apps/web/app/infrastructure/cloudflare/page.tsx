const isConfigured = Boolean(
  process.env.CLOUDFLARE_API_TOKEN &&
  process.env.CLOUDFLARE_ZONE_ID &&
  process.env.CORLEON_CLOUDFLARE_ANALYTICS_KEY,
);

const checks = [
  {
    name: 'Cloudflare API token',
    description: 'Read-only Analytics permission for the selected zone.',
    configured: Boolean(process.env.CLOUDFLARE_API_TOKEN),
  },
  {
    name: 'Cloudflare zone ID',
    description: 'The zone identifier for the domain being monitored.',
    configured: Boolean(process.env.CLOUDFLARE_ZONE_ID),
  },
  {
    name: 'Corleon API access key',
    description: 'A separate high-entropy bearer key for the protected analytics endpoint.',
    configured: Boolean(process.env.CORLEON_CLOUDFLARE_ANALYTICS_KEY),
  },
];

export const dynamic = 'force-dynamic';

export default function CloudflareInfrastructurePage() {
  return (
    <main className="shell">
      <nav className="nav">
        <a href="/"><strong>Corleon Engine</strong></a>
        <a href="/api/health">API health</a>
      </nav>

      <section className="hero">
        <p className="eyebrow">INFRASTRUCTURE INTELLIGENCE</p>
        <h1>Cloudflare Zone Analytics.</h1>
        <p className="lede">
          Domain-level traffic intelligence, response status breakdowns, cache visibility,
          and a protected analytics API powered by Cloudflare GraphQL.
        </p>
      </section>

      <section className="grid">
        <article className="card">
          <p className="eyebrow">CONNECTOR STATUS</p>
          <h2>{isConfigured ? 'Configuration present' : 'Awaiting secure configuration'}</h2>
          <p>
            {isConfigured
              ? 'All required environment variables are present. Analytics can be queried through the protected API.'
              : 'The connector is installed in code, but live data remains disabled until all required secrets are configured.'}
          </p>
        </article>
        <article className="card">
          <p className="eyebrow">DATA PROTECTION</p>
          <h2>Aggregates only</h2>
          <p>
            The integration returns aggregate request, response-byte, visit, edge-status,
            and cache-status metrics. It does not request client IP addresses or raw request logs.
          </p>
        </article>
      </section>

      <section className="status">
        <div>
          <p className="eyebrow">REQUIRED SERVER CONFIGURATION</p>
          <h2>Three server-side secrets/settings</h2>
          <p>
            Configure these in the Vercel project environment settings. Never put Cloudflare
            credentials in a NEXT_PUBLIC variable, source file, browser request, or commit.
          </p>
          <ul>
            {checks.map((check) => (
              <li key={check.name} style={{ marginBottom: 16 }}>
                <strong>{check.name}</strong>
                <p>{check.description}</p>
                <span>{check.configured ? 'Present' : 'Missing'}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="eyebrow">PROTECTED API</p>
          <h2><code>GET /api/integrations/cloudflare/analytics?range=24h</code></h2>
          <p>Supported ranges: 24h, 7d, 30d. Requires an Authorization: Bearer header using the Corleon analytics access key.</p>
          <p style={{ marginTop: 18 }}>
            This page intentionally does not render live metrics: the current application has
            no verified administrator sign-in boundary. Metrics remain behind the API key until
            an authenticated admin session is connected.
          </p>
        </div>
      </section>

      <footer className="status">
        <p>
          Read-only integration. No DNS changes, firewall changes, cache purges, billing changes,
          or production deployment actions are performed by this module.
        </p>
      </footer>
    </main>
  );
}
