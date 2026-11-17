import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSetupPlan,
  GOOGLE_PAY_WALLET_MCP_NAME,
  GOOGLE_PAY_WALLET_MCP_URL,
} from "./setup-google-pay-wallet-mcp.mjs";

const validEnv = {
  CLAUDE_CODE_CLIENT_ID: "example-client.apps.googleusercontent.com",
  CLAUDE_CODE_CLIENT_SECRET: "do-not-log-this-secret",
  CLAUDE_REDIRECT_PORT: "8787",
  PATH: process.env.PATH ?? "",
};

test("builds the documented Claude Code HTTP MCP command", () => {
  const plan = buildSetupPlan(validEnv);
  assert.equal(plan.command, "claude");
  assert.deepEqual(plan.args, [
    "mcp", "add", "--transport", "http",
    "--client-id", validEnv.CLAUDE_CODE_CLIENT_ID,
    "--client-secret", "--callback-port", "8787",
    GOOGLE_PAY_WALLET_MCP_NAME, GOOGLE_PAY_WALLET_MCP_URL,
  ]);
  assert.equal(plan.env.MCP_CLIENT_SECRET, validEnv.CLAUDE_CODE_CLIENT_SECRET);
});

test("never places the client secret in process arguments", () => {
  const plan = buildSetupPlan(validEnv);
  assert.equal(plan.args.includes(validEnv.CLAUDE_CODE_CLIENT_SECRET), false);
});

test("rejects missing OAuth client ID", () => {
  assert.throws(
    () => buildSetupPlan({ ...validEnv, CLAUDE_CODE_CLIENT_ID: "" }),
    /CLAUDE_CODE_CLIENT_ID is required/,
  );
});

test("rejects missing OAuth client secret", () => {
  assert.throws(
    () => buildSetupPlan({ ...validEnv, CLAUDE_CODE_CLIENT_SECRET: "" }),
    /CLAUDE_CODE_CLIENT_SECRET is required/,
  );
});

test("rejects invalid callback ports", () => {
  for (const port of ["abc", "80", "65536", "0"]) {
    assert.throws(
      () => buildSetupPlan({ ...validEnv, CLAUDE_REDIRECT_PORT: port }),
      /CLAUDE_REDIRECT_PORT/,
    );
  }
});
