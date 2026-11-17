export type PartnershipMetric = { label: string; value: string; change: string; trend: "up" | "down" | "flat"; helper: string };
export type PartnerRecord = { id: string; name: string; category: "Creator" | "Publisher" | "Affiliate" | "Referral"; channel: string; status: "Active" | "Prospect" | "Review"; reach: string; engagement: string; attributedRevenue: string; fitScore: number; rationale: string };
export type CampaignRecord = { id: string; name: string; channel: string; status: "Active" | "Draft" | "Review"; partners: number; attributedRevenue: string; conversionRate: string };
export type PartnershipIntelligencePayload = { mode: "demo"; generatedAt: string; notice: string; metrics: PartnershipMetric[]; partners: PartnerRecord[]; campaigns: CampaignRecord[]; capabilities: Array<{ id: string; name: string; description: string; status: "available" | "connect_required" | "approval_required"; requirement: string }>; insights: Array<{ title: string; body: string; category: string }> };

export const partnershipDemoData: Omit<PartnershipIntelligencePayload, "generatedAt"> = {
  mode: "demo",
  notice: "Illustrative sample data only. No live partner accounts, campaigns, attribution events, or external AI providers are connected.",
  metrics: [
    { label: "Attributed revenue", value: "₹8.42L", change: "+12.8%", trend: "up", helper: "Demo period: last 30 days" },
    { label: "Active partners", value: "128", change: "+8.4%", trend: "up", helper: "Synthetic partner records" },
    { label: "Partner conversions", value: "2,416", change: "+6.2%", trend: "up", helper: "Illustrative conversion events" },
    { label: "Avg. partner fit", value: "84/100", change: "+3 pts", trend: "up", helper: "Example scoring model" }
  ],
  partners: [
    { id: "p-001", name: "Northstar Tech Reviews", category: "Publisher", channel: "Editorial", status: "Active", reach: "420K", engagement: "5.8%", attributedRevenue: "₹1.82L", fitScore: 96, rationale: "Strong category relevance and consistent attributed conversions." },
    { id: "p-002", name: "The Everyday Edit", category: "Creator", channel: "Instagram", status: "Active", reach: "186K", engagement: "7.2%", attributedRevenue: "₹1.26L", fitScore: 93, rationale: "High audience engagement and strong product-content alignment." },
    { id: "p-003", name: "Deal Circuit India", category: "Affiliate", channel: "Coupon", status: "Review", reach: "310K", engagement: "3.1%", attributedRevenue: "₹94K", fitScore: 78, rationale: "Commercial fit is promising; validate traffic quality before activation." },
    { id: "p-004", name: "Build Better Daily", category: "Creator", channel: "YouTube", status: "Prospect", reach: "92K", engagement: "8.4%", attributedRevenue: "—", fitScore: 91, rationale: "Strong audience trust signals; commercial performance is not yet verified." },
    { id: "p-005", name: "Smart Buyer Journal", category: "Publisher", channel: "Editorial", status: "Active", reach: "275K", engagement: "4.9%", attributedRevenue: "₹76K", fitScore: 87, rationale: "Reliable evergreen content and steady assisted conversions." },
    { id: "p-006", name: "Local Loop Network", category: "Referral", channel: "Referral", status: "Prospect", reach: "58K", engagement: "6.6%", attributedRevenue: "—", fitScore: 82, rationale: "Regional reach may complement India-first acquisition." }
  ],
  campaigns: [
    { id: "c-001", name: "Everyday Essentials", channel: "Creator + Affiliate", status: "Active", partners: 42, attributedRevenue: "₹3.18L", conversionRate: "4.8%" },
    { id: "c-002", name: "Tech Upgrade Week", channel: "Editorial + YouTube", status: "Active", partners: 28, attributedRevenue: "₹2.64L", conversionRate: "3.9%" },
    { id: "c-003", name: "Festive Preview", channel: "Creator", status: "Draft", partners: 16, attributedRevenue: "—", conversionRate: "—" },
    { id: "c-004", name: "Value Finds", channel: "Coupon + Referral", status: "Review", partners: 19, attributedRevenue: "₹1.12L", conversionRate: "5.2%" }
  ],
  capabilities: [
    { id: "assistant", name: "AI business assistant", description: "Ask questions about approved partnership, campaign, and performance data.", status: "connect_required", requirement: "Connect an approved AI model and authenticated business data." },
    { id: "discovery", name: "Partner discovery", description: "Find creators, publishers, affiliates, and referral partners using explainable fit criteria.", status: "connect_required", requirement: "Connect a partner directory or approved discovery provider." },
    { id: "sentiment", name: "Brand sentiment", description: "Summarize public brand conversations and flag reputation changes.", status: "connect_required", requirement: "Configure a compliant social listening data source." },
    { id: "visibility", name: "AI search visibility", description: "Track brand mentions and citations in AI-generated answers.", status: "connect_required", requirement: "Connect an AI visibility data provider and define monitored prompts." },
    { id: "campaigns", name: "Campaign studio", description: "Prepare partner newsletters, briefs, and campaign content for review.", status: "approval_required", requirement: "Connect an email provider; human approval remains mandatory before sending." },
    { id: "marketplace", name: "Semantic marketplace", description: "Search approved products, services, suppliers, and partner opportunities.", status: "connect_required", requirement: "Connect a catalog and configure tenant-level access controls." }
  ],
  insights: [
    { title: "Validate before activating", body: "The sample scoring model highlights strong audience fit, but reach and engagement alone are not proof of incremental revenue. Verify traffic quality, audience overlap, and attribution before accepting a partner.", category: "Partner quality" },
    { title: "Keep campaigns reviewable", body: "Prepare newsletter copy and partner segments as drafts. Require an authorized reviewer to approve audience, claims, links, and send timing before distribution.", category: "Governance" },
    { title: "Measure beyond last click", body: "Capture introducer, assister, and closer roles where the source supports them. Compare attribution windows and avoid treating assisted conversions as incremental lift.", category: "Measurement" }
  ]
};
