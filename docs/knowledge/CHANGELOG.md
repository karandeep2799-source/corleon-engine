# Knowledge ingestion changelog

## 2026-11-10 — Initial repository-local coding-intelligence catalog

- Repository: `karandeep2799-source/corleon-engine`
- Base commit inspected: `f107d53aa1bdd8731ecd8dbbb05c3e2d982a148f`
- Branch: `docs/coding-intelligence-knowledge-2026-11-10`
- Added unique verified entries: 10
- Added watch entries: 1
- Meaningful updates to existing entries: 0
- Duplicate or unchanged prior findings skipped: 7
- Duplicate entries saved: 0
- Failed verification: 0 candidates saved on unverified claims; Apex-specific dated release claims were not found and were not stored.

### Existing knowledge inspected

- Repository tree: `docs/` contained `openai-developers-architecture.md` but no existing knowledge index/catalog.
- Existing MCP policy: `src/mcp/policy.js` contains a least-privilege tool policy; no official MCP TypeScript SDK package was declared in the inspected root manifest.
- Existing agent architecture: `docs/openai-developers-architecture.md` describes architect/coder/reviewer roles, an MCP gateway, and approval-gated writes.
- Existing Notion context: the Agent Skills Registry pages for Durable Workflows and AI SDK & Agents were blank; the AI Command Center describes the daily Capture → Classify → Plan → Execute → Verify → Close loop and production approval boundaries.
- Existing repo stack: Node `>=22 <25`, pnpm `12.4.0`, Turborepo `^2.5.6`, Prisma `^6.16.0`, Next.js `^16.0.0`, React `^19.2.0`, TypeScript `^5.9.2`.
- Existing GitHub Actions: `.github/workflows/ci.yml` and `.github/workflows/notion-sync.yml`; current triggers use `pull_request`, not `pull_request_target`; no Actions workflow lockfile was present.

### Unique items added

- [K-9122A5763F76](./entries/2026-11-10-coding-intelligence.md#vercel-workflow-sdk-websocket-writes) — Vercel Workflow SDK moves event and stream writes to WebSockets (verified, P1)
- [K-756B395AEDD8](./entries/2026-11-10-coding-intelligence.md#vercel-sandbox-snapshot-acceleration) — Vercel Sandbox snapshot creation and restore become substantially faster (verified, P1)
- [K-8D603FAF83B5](./entries/2026-11-10-coding-intelligence.md#gemini-cli-v0-67-cancellation-filesystem-safety) — Gemini CLI 0.67.0 strengthens cancellation, filesystem safety, and MCP permission context (verified, P1)
- [K-B8DDB6DB7E02](./entries/2026-11-10-coding-intelligence.md#codex-cli-v0-167-agent-command-center) — Codex CLI 0.167.0 adds agent command-center, cross-backend continuity, and stronger execution governance (verified, P1)
- [K-ACE31F3B0BB1](./entries/2026-11-10-coding-intelligence.md#claude-code-v2-1-321-fable-5-2-security-fixes) — Claude Code 2.1.321/2.1.322 adds Fable 5.2 and fixes MCP OAuth and sandbox permission bugs (verified, P0)
- [K-757A175D1806](./entries/2026-11-10-coding-intelligence.md#muse-ember-ai-gateway-subagent-model) — Muse Ember becomes available on Vercel AI Gateway for bounded multimodal agent subtasks (verified, P2)
- [K-57756F89CB81](./entries/2026-11-10-coding-intelligence.md#mcp-2026-07-28-stateless-spec-and-sdk-skills) — MCP 2026-07-28 makes Streamable HTTP stateless; TypeScript SDK 2.4.0 adds Skills over MCP (verified, P1)
- [K-1CAC63A3C060](./entries/2026-11-10-coding-intelligence.md#pnpm-12-18-agent-skill-approvals) — pnpm 12.18.0 adds per-skill approval and explicit agent-directory linking (verified, P1)
- [K-979601F2CA1A](./entries/2026-11-10-coding-intelligence.md#prisma-chatgpt-plugin-orm8-rc30) — Prisma launches its ChatGPT/Codex plugin while Prisma ORM 8 remains release-candidate software (verified, P2)
- [K-04146EFF0A70](./entries/2026-11-10-coding-intelligence.md#github-actions-lockfiles-and-pull-request-target-policy) — GitHub Actions workflow lockfiles are GA; pull_request_target becomes blocked by default in public repositories (verified, P1)
- [K-130D9BC72A1A](./entries/2026-11-10-coding-intelligence.md#nodejs-24-november-11-security-release-watch) — Node.js announces a November 11 security release with HIGH severity fixes on the 24.x line (watch, P0)

### Duplicates and unchanged findings skipped

- October Vercel Sandbox readiness/startup behavior — no new versioned change in this run; the November 9 snapshot optimization is recorded separately.
- October Vercel Drives general availability — unchanged; not re-entered.
- October GitHub Agentic Workflows general availability — unchanged; not re-entered.
- October GitHub Copilot Memory general availability — unchanged; not re-entered.
- October Codex Composer predictions — unchanged; not re-entered.
- October Claude Code safety-event telemetry and retry behavior — unchanged; not re-entered.
- October Gemini Computer Use and Gemini API CLI announcements — unchanged; the new Gemini CLI 0.67.0 release is recorded separately.

### Verification notes

- All saved release and feature claims were checked against official vendor changelogs, release pages, or specification repositories.
- Vercel snapshot retention evidence was cross-checked against the official docs: default 30-day expiry, storage charges while retained, and region-bound snapshots. The Node.js November 11 security release is an announcement-only watch item. The patched Node 24.x version and CVEs were not yet available at the time of this run.
- GitHub's Actions workflow-log secret scanning preview was excluded from the catalog because the announcement limits availability to eligible GitHub Enterprise Cloud customers with Secret Protection/Advanced Security; no access entitlement was verified for this repository.
- Turborepo 2.11 was checked but not promoted to a knowledge entry: its September release is not a new coding-agent development for the current JavaScript/TypeScript-only workspace. Revisit if Corleon adds Rust/Python/Go worker packages.
- No application runtime, dependency, schema, secret, infrastructure, payment, or deployment files were changed.
