# GitHub Actions automation

This repository uses GitHub Actions for CI validation, security analysis, issue triage, dependency maintenance, and guarded coding-agent repair.

## Workflows

| Workflow | Trigger | Purpose |
| --- | --- | --- |
| `CI` | Push / pull request | pnpm install, lint, typecheck, tests, production build |
| `Autonomous PR Repair` | Failed `CI` run | Assign Copilot to a same-repository failed PR, or open a repair issue |
| `Security` | Main push / PR / weekly schedule | CodeQL and dependency review |
| `Issue Triage` | Issue opened / reopened | Apply `needs-triage` |
| Dependabot | Weekly schedule | Update pnpm dependencies and GitHub Actions |

## Enable Copilot repair assignment

The failure workflow records a repair issue even when the agent token is not configured. To enable automatic Copilot assignment:

1. Confirm Copilot cloud agent is enabled for the account and repository (GitHub documents this feature for paid Copilot plans).
2. Create a fine-grained personal access token restricted to this repository with **Metadata: read** and **Actions, Contents, Issues, Pull requests: read and write**, as required by GitHub's Copilot issue-assignment API.
3. Add it under **Settings → Secrets and variables → Actions** as `COPILOT_AGENT_TOKEN`.
4. Never paste the token into a commit, issue, chat, or workflow file.

GitHub's Copilot agent assignment API is a preview feature and its permission and payload requirements may change. The workflow logs an actionable warning if assignment is rejected.\n\nEnable **Dependency graph** under **Settings → Code security and analysis** to activate the dependency-review check. Until then, the security workflow reports a warning and skips only that check; CodeQL remains active.

## Repair boundaries

- The workflow does not check out or execute pull-request code in a privileged context.
- Fork-originated CI failures are not automatically assigned.
- The agent works in its own branch/PR context; all changes require human review.
- No workflow merges, deploys, publishes, changes Vercel settings, runs production migrations, or enables financial execution.
- The agent must follow the repository-root `AGENTS.md` and `.github/agents/corleon-repair.agent.md`.

## Repository permissions

Workflow permissions are declared per workflow and limited to the operations required. The existing CI workflow remains the source of truth for application checks. Protect `main` with required CI and security checks in GitHub branch protection settings; these settings are not changed by committing workflow files.
