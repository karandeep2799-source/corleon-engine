import Link from "next/link";

export const metadata = {
  title: "Agent Runtime | Corleon Engine",
  description: "Governed agent execution, sessions, approvals and audit operations.",
};

const items = [
  ["Provider abstraction", "DigitalOcean Harness Runtime is the first provider. Vercel Sandbox remains an isolated adapter boundary."],
  ["Execution adapters", "Codex CLI, Claude Code and OpenCode run in isolated sessions with explicit task context."],
  ["Governance", "Default-ask tool policy, narrow egress, service-token API authentication and approval records."],
  ["Operations", "Durable jobs, session lifecycle records, idempotency keys and audit-event history."],
];

export default function AgentRuntimePage() {
  return (
    <main className="shell">
      <nav className="nav"><strong>Corleon Engine</strong><Link href="/">Platform home</Link></nav>
      <section className="hero">
        <p className="eyebrow">CORLEON AGENT RUNTIME</p>
        <h1>Governed execution for autonomous agents.</h1>
        <p className="lede">A provider-neutral execution control plane for coding agents, browser-enabled work and isolated sandbox sessions.</p>
        <div className="actions"><a href="/api/health">Platform health</a><a className="secondary" href="/api/agent-runtime">Runtime API (protected)</a></div>
      </section>
      <section className="grid">{items.map(([title, description]) => <article className="card" key={title}><p className="eyebrow">RUNTIME CONTROL</p><h2>{title}</h2><p>{description}</p></article>)}</section>
      <section className="status">
        <div><p className="eyebrow">SAFE BY DEFAULT</p><h2>Provisioning is opt-in</h2><p>Runtime provisioning remains disabled unless the server-side feature flag and provider credentials are configured. API access requires a dedicated bearer token. No cloud resource is created by this page.</p></div>
        <pre>{`Corleon API\n  → Durable Job\n  → Policy Gate\n  → Provider Adapter\n  → Isolated Session\n  → Audit + Approval`}</pre>
      </section>
    </main>
  );
}
