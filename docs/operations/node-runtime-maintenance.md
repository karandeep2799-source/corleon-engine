# Node.js runtime maintenance

## Supported runtime baseline

Corleon Engine's supported Node.js line is Node.js 24 LTS. The repository pin is recorded in `.node-version`; the root package manifest rejects versions below the patched baseline.

- Minimum supported patch: **24.22.3**
- Release line: **24.x (Krypton LTS)**
- Official security release: [Node.js 24.22.3](https://nodejs.org/en/blog/release/v24.22.3)
- Security advisory: [November 11, 2026 security releases](https://nodejs.org/en/blog/vulnerability/november-2026-security-releases)

Node.js 24.22.3 includes fixes for the November 11, 2026 security release, including high-severity HTTP/2 and TLS issues. Keep the pin at the newest approved 24.x patch after each security release; do not downgrade to an earlier patch.

## Local and CI enforcement

1. Install the exact version in `.node-version` using a version manager that supports that file.
2. Verify `node --version` reports `v24.22.3` or newer within the 24.x line.
3. Run `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.
4. CI reads `.node-version` through `actions/setup-node`, so local and CI patch baselines stay aligned.

The root `engines.node` range is `>=24.22.3 <25`. This deliberately moves the repository from its former Node 22/24 range to the project's Node 24 LTS baseline.

## Vercel runtime boundary

The connected Vercel project is configured for the **24.x** runtime line. Vercel selects and maintains the patch within that major line; the project setting does not pin a specific Node patch. This repository change does not alter Vercel settings or trigger a production deployment.

For a release, verify the actual Node version shown in the Vercel build/runtime logs and confirm it is at least 24.22.3 before promoting or relying on the deployment. If the managed runtime is behind, pause the release and escalate through Vercel support/status rather than changing production configuration ad hoc.

## Upgrade procedure

1. Check the official Node.js security release page and release schedule.
2. Select the latest supported 24.x patch; review its release notes and security advisories.
3. Update `.node-version` and the root `engines.node` minimum together.
4. Run the full CI suite and inspect dependency compatibility.
5. Confirm the Vercel managed runtime patch from build/runtime logs.
6. Submit a reviewable PR. Merge and production release require separate approval.

## Operational guardrails

- Do not install Node 25.x or 26.x for this application without a separate compatibility review.
- Do not weaken the engine floor to make an outdated local or CI runtime pass.
- Never copy secrets into runtime diagnostics or issue comments.
- Do not change Vercel project settings, production deployments, dependencies, database schemas, or payment configuration as part of routine patch maintenance.
