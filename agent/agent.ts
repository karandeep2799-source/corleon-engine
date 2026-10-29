import { defineAgent } from "eve";

/**
 * Corleon content copilot.
 * Default tools are disabled; only explicitly configured connections are exposed.
 */
const MAX_NEW_INPUT_TOKENS = 300_000;
const MAX_OUTPUT_TOKENS = 16_000;

export default defineAgent({
  defaultTools: false,
  compaction: { thresholdPercent: 0.75 },
  limits: {
    sessionUsage: ({ window }) =>
      window.inputTokens - window.cacheReadTokens >= MAX_NEW_INPUT_TOKENS ||
      window.outputTokens >= MAX_OUTPUT_TOKENS,
  },
  model: process.env.CORLEON_AGENT_MODEL ?? "anthropic/claude-sonnet-5",
});
