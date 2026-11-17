"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { PartnershipIntelligencePayload, PartnerRecord } from "../../lib/partnership-intelligence/demo-data";

type View = "overview" | "partners" | "campaigns" | "governance";
const views: Array<{ id: View; label: string; icon: string }> = [
  { id: "overview", label: "Overview", icon: "◫" },
  { id: "partners", label: "Partner intelligence", icon: "◎" },
  { id: "campaigns", label: "Campaigns", icon: "▤" },
  { id: "governance", label: "AI governance", icon: "◇" }
];

function StatusPill({ status }: { status: string }) {
  return <span className={"pi-pill pi-pill-" + status.toLowerCase().replaceAll(" ", "-")}>{status}</span>;
}

function PartnerRow({ partner }: { partner: PartnerRecord }) {
  return <tr>
    <td><div className="pi-partner-name">{partner.name}</div><div className="pi-muted">{partner.category} · {partner.channel}</div></td>
    <td><StatusPill status={partner.status} /></td><td>{partner.reach}</td><td>{partner.engagement}</td><td>{partner.attributedRevenue}</td>
    <td><div className="pi-score"><span>{partner.fitScore}</span><div className="pi-score-track"><i style={{ width: partner.fitScore + "%" }} /></div></div></td>
  </tr>;
}

export default function PartnershipDashboard() {
  const [data, setData] = useState<PartnershipIntelligencePayload | null>(null);
  const [view, setView] = useState<View>("overview");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/partnership-intelligence", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load the partnership workspace.");
        return (await response.json()) as PartnershipIntelligencePayload;
      })
      .then((payload) => { if (active) setData(payload); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Unexpected loading error."); });
    return () => { active = false; };
  }, []);

  const partners = useMemo(() => {
    if (!data) return [];
    const normalized = query.trim().toLowerCase();
    return data.partners.filter((partner) => {
      const matchesQuery = !normalized || [partner.name, partner.category, partner.channel].some((value) => value.toLowerCase().includes(normalized));
      return matchesQuery && (category === "All" || partner.category === category);
    });
  }, [data, query, category]);

  if (error) return <main className="pi-shell"><div className="pi-error"><h1>Workspace unavailable</h1><p>{error}</p><button onClick={() => window.location.reload()}>Try again</button></div></main>;
  if (!data) return <main className="pi-shell"><div className="pi-loading"><span className="pi-spinner" />Loading partnership intelligence…</div></main>;

  return <main className="pi-shell">
    <aside className="pi-sidebar">
      <Link className="pi-brand" href="/"><span className="pi-brand-mark">C</span><span>corleon<span className="pi-brand-light"> engine</span></span></Link>
      <div className="pi-workspace-label">WORKSPACE</div><div className="pi-workspace"><span className="pi-workspace-dot" /> Growth & Partnerships <span className="pi-chevron">⌄</span></div>
      <div className="pi-nav-label">INTELLIGENCE</div>
      <nav className="pi-nav" aria-label="Partnership intelligence navigation">
        {views.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}><span className="pi-nav-icon">{item.icon}</span>{item.label}</button>)}
      </nav>
      <div className="pi-sidebar-bottom"><div className="pi-security-mark">◇</div><strong>Governed by design</strong><p>Read-only demo workspace. External actions are not enabled.</p><a href="/api/health">Platform health ↗</a></div>
    </aside>
    <section className="pi-main">
      <header className="pi-topbar"><div className="pi-breadcrumb">Corleon Engine <span>/</span> Growth <span>/</span> <strong>Partnership intelligence</strong></div><div className="pi-topbar-right"><span className="pi-demo-badge">DEMO DATA</span><span className="pi-avatar">CE</span></div></header>
      <div className="pi-content">
        <div className="pi-heading-row"><div><p className="pi-kicker">GROWTH INTELLIGENCE</p><h1>{view === "overview" ? "Partnership intelligence" : views.find((item) => item.id === view)?.label}</h1><p className="pi-subtitle">Find the relationships that create measurable, trusted growth.</p></div><div className="pi-heading-actions"><span className="pi-date-chip">Last 30 days <span>⌄</span></span><button className="pi-export" onClick={() => window.print()}>Export view ↗</button></div></div>
        <div className="pi-notice"><span>i</span><p><strong>Illustrative demo environment.</strong> {data.notice}</p></div>
        {(view === "overview" || view === "partners") && <>
          <div className="pi-metrics">{data.metrics.map((metric) => <article className="pi-metric-card" key={metric.label}><div className="pi-metric-label">{metric.label}<span>↗</span></div><div className="pi-metric-value">{metric.value}</div><div className="pi-metric-footer"><span className="pi-change">{metric.change}</span><span className="pi-muted">{metric.helper}</span></div></article>)}</div>
          <section className="pi-panel"><div className="pi-panel-heading"><div><p className="pi-kicker">PARTNER PORTFOLIO</p><h2>Partner performance & fit</h2></div><div className="pi-table-controls"><label className="pi-search"><span>⌕</span><input aria-label="Search partners" placeholder="Search partners…" value={query} onChange={(event) => setQuery(event.target.value)} /></label><select aria-label="Filter by partner type" value={category} onChange={(event) => setCategory(event.target.value)}><option>All</option><option>Creator</option><option>Publisher</option><option>Affiliate</option><option>Referral</option></select></div></div>
            <div className="pi-table-wrap"><table><thead><tr><th>PARTNER</th><th>STATUS</th><th>REACH</th><th>ENGAGEMENT</th><th>ATTRIBUTED</th><th>FIT SCORE</th></tr></thead><tbody>{partners.map((partner) => <PartnerRow key={partner.id} partner={partner} />)}</tbody></table>{partners.length === 0 && <div className="pi-empty">No partners match these filters.</div>}</div>
            <div className="pi-panel-foot">Showing {partners.length} of {data.partners.length} synthetic partner records <span>Fit scores are illustrative, not automated decisions.</span></div>
          </section>
        </>}
        {(view === "overview" || view === "campaigns") && <section className="pi-panel pi-campaign-panel"><div className="pi-panel-heading"><div><p className="pi-kicker">ACTIVATION</p><h2>Campaign performance</h2></div><span className="pi-muted">Sample campaigns</span></div><div className="pi-campaign-grid">{data.campaigns.map((campaign) => <article className="pi-campaign-card" key={campaign.id}><div className="pi-campaign-top"><span className="pi-campaign-icon">↗</span><StatusPill status={campaign.status} /></div><h3>{campaign.name}</h3><p>{campaign.channel}</p><div className="pi-campaign-stats"><div><strong>{campaign.attributedRevenue}</strong><span>Attributed revenue</span></div><div><strong>{campaign.conversionRate}</strong><span>Conversion rate</span></div></div><div className="pi-campaign-foot">{campaign.partners} partners in segment</div></article>)}</div></section>}
        {(view === "overview" || view === "governance") && <section className="pi-lower-grid">
          <div className="pi-panel pi-capabilities"><div className="pi-panel-heading"><div><p className="pi-kicker">AI CAPABILITY MAP</p><h2>What is ready to connect</h2></div></div>
            {data.capabilities.map((capability) => <div className="pi-capability" key={capability.id}><div className="pi-capability-icon">{capability.id === "assistant" ? "✳" : capability.id === "campaigns" ? "▤" : "◇"}</div><div className="pi-capability-copy"><strong>{capability.name}</strong><p>{capability.description}</p><small>{capability.requirement}</small></div><StatusPill status={capability.status === "available" ? "Ready" : capability.status === "approval_required" ? "Approval gate" : "Connect required"} /></div>)}
          </div>
          <div className="pi-panel pi-insights"><div className="pi-panel-heading"><div><p className="pi-kicker">OPERATOR NOTES</p><h2>Signals worth reviewing</h2></div></div>
            {data.insights.map((insight) => <article className="pi-insight" key={insight.title}><span>{insight.category}</span><h3>{insight.title}</h3><p>{insight.body}</p></article>)}
            <div className="pi-governance-note"><strong>Human approval stays in control.</strong><p>Partner acceptance, outreach, campaign sends, payments, and contract changes are not available in this demo.</p></div>
          </div>
        </section>}
        <footer className="pi-footer"><span>Corleon Engine · Partnership Intelligence</span><span>Read-only demonstration · Updated {new Date(data.generatedAt).toLocaleString()}</span></footer>
      </div>
    </section>
  </main>;
}
