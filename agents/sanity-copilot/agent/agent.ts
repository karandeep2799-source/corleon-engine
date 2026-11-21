import { defineAgent } from "eve";

export default defineAgent({
  compaction: { thresholdPercent: 0.75 },
  model: process.env.CORLEON_AGENT_MODEL ?? "anthropic/claude-sonnet-5",
});
