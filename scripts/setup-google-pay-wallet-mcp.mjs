#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const GOOGLE_PAY_WALLET_MCP_URL = "https://paydeveloper.googleapis.com/mcp";
export const GOOGLE_PAY_WALLET_MCP_NAME = "google-pay-wallet-dev";

export function buildSetupPlan(env = process.env) {
  const clientId = env.CLAUDE_CODE_CLIENT_ID?.trim();
  const clientSecret = env.CLAUDE_CODE_CLIENT_SECRET;
  const callbackPort = env.CLAUDE_REDIRECT_PORT?.trim();

  if (!clientId) throw new Error("CLAUDE_CODE_CLIENT_ID is required.");
  if (!clientSecret) throw new Error("CLAUDE_CODE_CLIENT_SECRET is required.");
  if (!callbackPort || !/^\\d{1,5}$/.test(callbackPort)) {
    throw new Error("CLAUDE_REDIRECT_PORT must be a valid TCP port.");
  }

  const port = Number(callbackPort);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error("CLAUDE_REDIRECT_PORT must be between 1024 and 65535.");
  }

  return {
    command: "claude",
    args: [
      "mcp", "add", "--transport", "http",
      "--client-id", clientId, "--client-secret",
      "--callback-port", String(port),
      GOOGLE_PAY_WALLET_MCP_NAME, GOOGLE_PAY_WALLET_MCP_URL,
    ],
    // The secret is passed only through the child process environment.
    env: { ...env, MCP_CLIENT_SECRET: clientSecret },
  };
}

function run() {
  let plan;
  try {
    plan = buildSetupPlan();
  } catch (error) {
    process.stderr.write(`Google Pay & Wallet MCP setup: ${error.message}\\n`);
    process.exitCode = 1;
    return;
  }

  process.stdout.write(JSON.stringify({
    event: "corleon.integration.setup.started",
    integration: GOOGLE_PAY_WALLET_MCP_NAME,
    transport: "http",
    server: GOOGLE_PAY_WALLET_MCP_URL,
    callbackPort: Number(process.env.CLAUDE_REDIRECT_PORT),
  }) + "\\n");

  const result = spawnSync(plan.command, plan.args, {
    env: plan.env, stdio: "inherit", shell: false,
  });

  if (result.error) {
    process.stderr.write(`Unable to start Claude Code: ${result.error.message}\\n`);
    process.exitCode = 1;
    return;
  }
  if (result.status !== 0) {
    process.stderr.write(`Claude Code MCP setup exited with status ${result.status ?? "unknown"}.\\n`);
    process.exitCode = result.status ?? 1;
    return;
  }

  process.stdout.write(JSON.stringify({
    event: "corleon.integration.setup.completed",
    integration: GOOGLE_PAY_WALLET_MCP_NAME,
    nextStep: "Run claude, then authenticate the google-pay-wallet-dev server.",
  }) + "\\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) run();
