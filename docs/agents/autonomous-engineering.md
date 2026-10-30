# Corleon Autonomous Engineering Agent

This runbook configures a hybrid engineering agent for PR #1.

## Operating model

- **Online execution:** GitHub Actions dispatches jobs to a dedicated Linux VPS self-hosted runner labelled `corleon-agent`. Codex runs with the workspace permission profile. A separate GitHub-hosted publish job applies the patch and pushes it to the selected feature branch.
- **Offline execution:** the VPS can use a pre-downloaded local model and a local coding agent against a separate worktree. Offline changes remain local until connectivity returns; they must be reviewed and synchronized before publication.
- **Persistence:** GitHub stores workflow history and branch commits. A durable task queue/database is a later platform integration; this workflow does not pretend a scheduled GitHub job is a continuously running daemon.
- **Safety:** the agent cannot merge PRs, deploy production, alter secrets, or perform live financial actions. The publish job receives write permission only after the model job has finished; the model job receives read-only GitHub permissions.

## Required GitHub configuration

1. Add a repository self-hosted runner for a dedicated Linux VPS.
2. Run the runner service as the unprivileged OS account `corleon-agent`; do not run it as root and do not grant it sudo.
3. Add the custom runner label `corleon-agent` (the workflow also requires the default `self-hosted`, `linux`, and `x64` labels).
4. Add repository Actions secret `OPENAI_API_KEY`.
5. Enable Actions for the repository and allow GitHub Actions to create and approve pull requests only if a future workflow explicitly needs that permission. This workflow only needs contents read in the agent job and contents write in the isolated publish job.
6. Ensure the runner has outbound HTTPS access to GitHub and package registries. GitHub self-hosted runners must be online to receive jobs.

## VPS prerequisites

Use a supported Ubuntu/Debian x64 host with:
- Node.js 24
- pnpm 10.15.0
- Git
- Docker only if later workloads need containers
- GitHub Actions runner installed and configured as a system service
- A dedicated, non-root `corleon-agent` user owning its runner workspace

Do not store API keys in the repository, shell history, workflow YAML, or a checked-in `.env` file. Put `OPENAI_API_KEY` in GitHub Actions secrets. Use a secret manager for any future local-only credentials.

## Start the first run

After the runner is online and the secret is configured:

1. Open **Actions → Corleon autonomous engineering agent → Run workflow**.
2. Select branch `feat/production-foundation`.
3. Keep the default task or enter a specific PR #1 issue.
4. Inspect the run log and the uploaded `agent-result.md` artifact.
5. Inspect the resulting commit on `feat/production-foundation` and the PR checks before approving anything.

The daily schedule is evaluated from the default branch. The workflow must be merged to the default branch before scheduled runs become active. Until then, use `workflow_dispatch` from this feature branch.

## Offline mode

A network outage prevents GitHub Actions from dispatching new work. For genuinely offline coding, install and pre-pull a local coding model (for example, an Ollama-compatible coder model) and an offline-capable coding agent on the VPS. Keep offline work in a dedicated Git worktree and branch, never in the runner's active checkout. Queue tasks in local files, run local tests, and do not push until connectivity returns. Rebase and resolve conflicts before opening or updating a PR.

Offline model quality depends on VPS RAM/VRAM and the model selected. This repository change does not install a model or start a daemon because the VPS hardware, OS access, and model storage are not available from GitHub.

## Operational limits

- GitHub Actions schedules are best-effort, not an exact-time scheduler.
- Self-hosted runners are trusted infrastructure. Do not run untrusted fork PR code on this runner.
- The agent can edit the selected feature branch but cannot merge it.
- The current PR explicitly blocks live exchange execution. Preserve that boundary.
- The Vercel free deployment-per-day limit reported on PR #1 is separate from this agent workflow; CI should not repeatedly trigger Vercel deployments.
- Monitor runner health, job duration, API spend, artifact retention, and failed runs. Rotate the API key immediately if it is exposed.
