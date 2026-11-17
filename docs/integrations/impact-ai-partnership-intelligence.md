# Corleon Partnership Intelligence

## Purpose

This feature translates selected impact.com product patterns into a native Corleon Engine workspace: conversational business intelligence, partner discovery, brand sentiment, AI-search visibility, campaign content preparation, and semantic marketplace search.

It is an independent implementation. It does not copy impact.com source code, private model weights, datasets, or proprietary interfaces.

## Current implementation

- apps/web/app/partnership-intelligence/ contains the responsive dashboard.
- apps/web/app/api/partnership-intelligence/route.ts serves a read-only, synthetic demo payload.
- apps/web/lib/partnership-intelligence/demo-data.ts owns the typed demo records and capability registry.
- apps/web/lib/partnership-intelligence/demo-data.test.ts validates demo-data invariants.
- Open /partnership-intelligence in the Next.js application.

All displayed figures, partner identities, campaign names, scores, and trends are fictional. The API deliberately returns only synthetic data and does not access customer records, external accounts, or model providers.

## Activation plan

The dashboard is a reviewable product surface, not a claim that third-party integrations are already connected. Before enabling live functionality:

1. **Identity and tenancy:** integrate the existing Corleon authentication boundary. Resolve tenant and actor from a verified server session; never accept tenant IDs from browser input.
2. **Persistence:** add tenant-scoped Prisma models for partner profiles, sources, campaign definitions, attribution events, model evaluations, consent records, and audit events. Include indexes, retention rules, and migrations.
3. **Data connectors:** implement allowlisted, least-privilege adapters for approved partner, analytics, social-listening, and AI-visibility providers. Store credentials only in the deployment secret manager.
4. **AI gateway:** route assistant and scoring workloads through the existing model-selection and policy layer. Require structured outputs, source provenance, bounded context, timeouts, rate limits, and prompt-injection defenses.
5. **Evaluation:** maintain golden datasets and evaluate relevance, factuality, bias, drift, and explanation quality before enabling recommendations.
6. **Human review:** keep partner acceptance, outreach, newsletter sends, contract changes, payments, and other consequential operations behind explicit authorization and approval records.
7. **Observability:** record correlation IDs, actor, tenant, model/provider, policy decision, data sources, token/cost metadata, and outcome without logging secrets or unnecessary personal data.

## Governance defaults

- External actions are disabled until the relevant connector, permission scope, and approval workflow are configured.
- Recommendations must include reason codes and source timestamps.
- Do not infer sensitive personal traits from creator or audience data.
- Respect platform terms, consent, opt-out, data minimization, and applicable India privacy and marketing requirements.
- Never use audience size or engagement alone as proof of incremental revenue.
- Keep demo fixtures separate from production records and exclude them from financial or business reporting.

## Validation

Run from the repository root:

\`\`\`bash
pnpm --filter @corleon/web test
pnpm --filter @corleon/web typecheck
pnpm --filter @corleon/web lint
pnpm --filter @corleon/web build
\`\`\`

A successful build does not activate providers or establish production readiness for live partner data. Complete the activation plan and run authenticated integration tests before launch.

## Reference

- impact.com AI feature overview: https://help.impact.com/other/reference-documentation/ask-impact/impact.com-ai-features-explained.md
- impact.com AI platform: https://impact.com/ai/
- impact.com Ask Impact guidance: https://help.impact.com/brand/what-would-you-like-to-learn-about/platform-features/ask-impact/ask-impact-tips-and-tricks
