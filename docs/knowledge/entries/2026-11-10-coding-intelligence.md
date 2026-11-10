# Coding Intelligence Evidence Report — 2026-11-10

Checked date: 2026-11-10. This report distinguishes primary-source facts from Corleon-specific analysis. Source links are canonical vendor or project links.

## Repository baseline inspected

- Root package: Node `>=22 <25`, pnpm `12.4.0`, Turborepo `^2.5.6`, Prisma `^6.16.0`, OpenAI Agents `^0.17.0`.
- Web workspace: Next.js `^16.0.0`, React `^19.2.0`, TypeScript `^5.9.2`.
- MCP: `src/mcp/policy.js` is the inspected policy module; it allows repository reads, Prisma inspection, logs, tests, and preview deployment; requires approval for repository/database writes and migrations; denies secrets and production DB access.
- GitHub Actions: CI uses Node 24 and action tags such as `actions/checkout@v4`; current workflows use `pull_request`, not `pull_request_target`.
- Knowledge storage: no existing repository-local knowledge index was found; this directory seeds the first catalog.

## Verified developments

### 1. Vercel Workflow SDK 5.2.0+ uses WebSockets for event and stream writes

- **Verified facts:** Published 2026-11-09. Event and stream writes use WebSockets by default; existing stream code needs no change beyond upgrading to `workflow@5.2.0` or later. New runs use the upgraded deployment; in-flight runs stay on their starting deployment.
- **Maturity/limits:** Available behavior in the Vercel changelog. No independent benchmark is published. Corleon does not currently declare the `workflow` package.
- **Analysis/recommendation:** High relevance to durable agent orchestration and streaming. Prototype behind an adapter and measure latency, throughput, replay, and resume semantics before adoption.
- **Source:** https://vercel.com/changelog/workflow-writes-now-use-websockets-on-vercel
- **Knowledge ID:** K-9122A5763F76.

### 2. Vercel Sandbox snapshots are faster

- **Verified facts:** Published 2026-11-09. Vercel reports snapshot median below 0.4s (from 4.4s) and restore p50 250ms (from 500ms). Persistent sandboxes automatically snapshot on stop and resume from the latest snapshot; existing snapshots retain the old format.
- **Maturity/limits:** Platform rollout; performance figures are vendor-reported. Corleon does not currently declare `@vercel/sandbox`.
- **Analysis/recommendation:** High relevance to pause/resume and isolated coding workers. Keep PostgreSQL as the run-state system of record and benchmark a representative repository.
- **Source:** https://vercel.com/changelog/vercel-sandbox-snapshot-creation-is-now-up-to-10x-faster
- **Knowledge ID:** K-756B395AEDD8.

### 3. Gemini CLI 0.67.0 improves cancellation and filesystem safety

- **Verified facts:** Published 2026-11-04. The release prevents tool execution after cancellation, stops continuation/auto-nudge processing, respects read-only files and hard links in atomic writes, resolves paths against the active IDE workspace root, and includes MCP server/tool metadata in permission requests.
- **Maturity/limits:** Stable tagged CLI release. No claim is made that these behaviors automatically apply to Corleon.
- **Analysis/recommendation:** High relevance. Turn these into Corleon cancellation, path-boundary, hard-link, and approval-context regression tests.
- **Source:** https://github.com/google-gemini/gemini-cli/releases/tag/v0.67.0
- **Knowledge ID:** K-8D603FAF83B5.

### 4. Codex CLI 0.167.0 improves agent/session continuity and governance

- **Verified facts:** Published 2026-11-06. The release adds an agent command center, unread-result indicators, cross-backend session switching while retaining drafts, readable transcripts when a session cannot resume, per-chat MCP connection leases, fresh approval checkpoints, Guardian review of recorded execution calls, and context/truncation metrics.
- **Maturity/limits:** Stable release; some unrelated setup options remain feature-flagged.
- **Analysis/recommendation:** High relevance. Model-provider changes should not destroy conversation continuity. Scope MCP connections to a chat/run and bind approvals to exact commands and policy versions.
- **Source:** https://github.com/openai/codex/releases/tag/rust-v0.167.0
- **Knowledge ID:** K-B8DDB6DB7E02.

### 5. Claude Code 2.1.321/2.1.322 and Claude Fable 5.2

- **Verified facts:** v2.1.321 was published 2026-11-09; v2.1.322 on 2026-11-10. v2.1.321 adds Fable 5.2 and fixes MCP OAuth secret forwarding after redirects, sandbox permission gaps for read-only Bash and file writes, and protected-file checks for copy/move destinations. v2.1.322 adds Fable fast mode on Vertex in global/US/EU regions with standard-speed fallback.
- **Maturity/limits:** Stable Claude Code releases. Anthropic's Fable 5.2 is available; the Vercel AI Gateway route does not support ZDR and retains prompts/completions for 30 days.
- **Analysis/recommendation:** High relevance to Corleon MCP OAuth and sandbox policy. Add redirect-host and canonical-path regression tests. Evaluate Fable only on an approved data route.
- **Sources:** https://github.com/anthropics/claude-code/releases/tag/v2.1.321 ; https://github.com/anthropics/claude-code/releases/tag/v2.1.322 ; https://www.anthropic.com/claude-fable-and-mythos-5-2 ; https://vercel.com/changelog/claude-fable-5-2-now-available-on-ai-gateway
- **Knowledge ID:** K-ACE31F3B0BB1.

### 6. Muse Ember is available through Vercel AI Gateway

- **Verified facts:** Published 2026-11-09. Vercel describes Muse Ember as a lightweight reasoning model for bounded coding subtasks, tool calls, and document analysis; it accepts text/image/video, has a stated 1M context window, supports tool calling and adjustable reasoning effort.
- **Maturity/limits:** Available through AI Gateway. The source does not provide independent benchmarks or a cost comparison.
- **Analysis/recommendation:** Medium-high relevance as an evaluation candidate for bounded subagents; do not assume quality or cost advantage from the product description.
- **Source:** https://vercel.com/changelog/muse-ember-now-available-on-ai-gateway
- **Knowledge ID:** K-757A175D1806.

### 7. MCP 2026-07-28 is stateless; TypeScript SDK 2.4.0 adds Skills over MCP

- **Verified facts:** The stable protocol revision was released 2026-07-28. It removes Streamable HTTP sessions and the initialize handshake, adds `server/discover` and `subscriptions/listen`, removes SSE resumability, adds multi-round-trip requests, moves tasks to an extension, and standardizes cache metadata and OAuth issuer binding. TypeScript SDK 2.4.0 was released 2026-10-23 and adds Skills over MCP; SkillsClient verifies skill digests while server `attach` remains experimental.
- **Maturity/limits:** Protocol and SDK v2 are stable; the server-side Skills attachment API is experimental. v1.x continues receiving fixes and security updates for at least six months after v2 shipped.
- **Analysis/recommendation:** High relevance because Corleon currently has a policy module but no declared official MCP SDK. Design a version-aware adapter and test both protocol revisions before migration.
- **Sources:** https://github.com/modelcontextprotocol/modelcontextprotocol/releases/tag/2026-07-28 ; https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2026-07-28/changelog.mdx ; https://github.com/modelcontextprotocol/typescript-sdk/releases/tag/v2.4.0
- **Knowledge ID:** K-57756F89CB81.

### 8. pnpm 12.18.0 adds per-skill approval

- **Verified facts:** Published 2026-11-05. pnpm can approve selected agent skills per package, record target agent directories, link nested skills up to three levels, and resolve name conflicts with package-qualified names.
- **Maturity/limits:** Stable release. Corleon currently pins pnpm 12.4.0 and has a `codex/skills` directory; no package-managed skill flow was found.
- **Analysis/recommendation:** High relevance to supply-chain control for agent skills. Evaluate in a separate dependency PR and approve individual skills rather than all skills from a package.
- **Source:** https://pnpm.io/blog/releases/12.18.0
- **Knowledge ID:** K-1CAC63A3C060.

### 9. Prisma ChatGPT/Codex plugin and Prisma ORM 8 RC.30

- **Verified facts:** Prisma published the plugin on 2026-11-04; it connects ChatGPT and Codex to Prisma ORM, Prisma Postgres, and Prisma Compute. Prisma ORM 8.0.0-rc.30 was released 2026-11-03 and remains an RC. It changes Composer naming from `--stage` to `--environment`, requires matching Composer extension versions, and changes missing-secret handling in local Composer development.
- **Maturity/limits:** Plugin available; ORM 8 is not stable. Console-generated workflows still using `--stage` can break on rc.30.
- **Analysis/recommendation:** Medium relevance. Keep Corleon on Prisma 6.16 and Vercel/PostgreSQL; evaluate the plugin only as a developer workflow and do not use `prisma@latest` in CI.
- **Source:** https://www.prisma.io/changelog/2026-11-04
- **Knowledge ID:** K-979601F2CA1A.

### 10. GitHub Actions workflow lockfiles are GA; pull_request_target changes in December

- **Verified facts:** Workflow lockfiles became GA on 2026-10-28 and pin actions plus transitive dependencies to exact commits. GitHub announced that public repositories will block `pull_request_target` by default from 2026-12-02, with brownouts on Nov 9 and Nov 16. The inspected Corleon workflows do not use `pull_request_target`.
- **Maturity/limits:** Lockfiles are GA; the policy is announced and currently in evaluate mode until enforcement.
- **Analysis/recommendation:** High relevance to CI supply-chain security. Corleon uses mutable action tags and has no `actions.lock`; adopt lockfiles in a separate reviewable security PR.
- **Sources:** https://github.blog/changelog/2026-10-28-github-actions-workflow-lockfiles-are-generally-available/ ; https://github.blog/changelog/2026-11-02-pull_request_target-blocked-by-default-december-2/
- **Knowledge ID:** K-04146EFF0A70.

### 11. Node.js November 11 security release watch

- **Verified facts:** The Node.js project announced on 2026-11-03 that releases for 26.x, 24.x, and 22.x would be published on or shortly after 2026-11-11, with a highest severity of HIGH on each line. Node 24.22.2 LTS is the current inspected 24.x patch from 2026-10-28.
- **Maturity/limits:** Announcement only as of the checked date; patched version numbers and CVE details are not yet available.
- **Analysis/recommendation:** P0 watch. On the next run after Nov 11, verify the actual patched 24.x release and advise a patch update. Do not guess CVEs or patch numbers.
- **Sources:** https://nodejs.org/en/blog/vulnerability/november-2026-security-releases ; https://nodejs.org/en/blog/release/v24.22.2
- **Knowledge ID:** K-130D9BC72A1A.

## Checked but not promoted

- **Apex:** no new dated official Apex coding-agent release or product changelog was verified in this pass. No speculative item was stored.
- **Next.js 16 / React 19 / PostgreSQL 18:** no new release item with a direct Corleon coding-agent impact was verified in the sources checked.
- **Turborepo 2.11:** the September 18 release adds native Rust/Python/Go support, more package managers, and production pruning. It was not promoted because the current workspace is JavaScript/TypeScript and the release does not provide a direct new agent capability; revisit if Corleon adds multi-language workers.
- **GitHub Actions secret scanning for workflow logs:** the November 9 preview is restricted to eligible GitHub Enterprise Cloud customers with Secret Protection/Advanced Security; repository entitlement was not verified, so no adoption recommendation was made.

## Prioritized engineering takeaways

1. **P0 — Node.js security watch:** verify and apply the official Node 24 security patch after the November 11 release; no patch was available to apply at this check.
2. **P1 — MCP security and compatibility:** add OAuth redirect issuer/host binding tests, canonical path checks, and a version-aware MCP adapter for the 2026-07-28 stateless protocol.
3. **P1 — Durable execution:** prototype Vercel Workflow SDK 5.2.0+ and persistent Sandbox snapshots behind adapters; benchmark with Corleon workloads.
4. **P1 — Agent governance:** use Codex/Gemini/Claude release lessons for per-chat MCP leases, cancellation propagation, exact-command approval checkpoints, and context telemetry.
5. **P1 — Skills supply chain:** evaluate pnpm 12.18.0 per-skill approvals and MCP SDK SkillsClient digest verification.
6. **P1 — CI supply chain:** adopt GitHub Actions workflow lockfiles and add a stale-lockfile check.
7. **P2 — Model routing:** evaluate Fable 5.2 and Muse Ember on non-sensitive, bounded tasks; measure verified quality, cost, latency, and retention suitability.
8. **P2 — Prisma:** keep the current Prisma 6.16 stack; treat the plugin as an optional dev workflow and wait for Prisma ORM 8 GA before planning migration.

## Execution boundary

Only repository inspection and documentation-catalog creation were performed. No runtime code, dependencies, Prisma schema/migrations, secrets, environment variables, infrastructure, production settings, payment systems, or deployment configuration were modified.
