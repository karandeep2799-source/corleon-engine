import { defineAgent } from "eve";

export default defineAgent({
  defaultTools: false,
  description:
    "Research a topic on the open web for facts, statistics, primary sources, and links. Return cited findings, confidence levels, and gaps that could not be verified.",
  model: process.env.CORLEON_RESEARCH_MODEL ?? "openai/gpt-5.6-terra",
  tool: false,
});
