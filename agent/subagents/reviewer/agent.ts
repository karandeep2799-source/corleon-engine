import { defineAgent } from "eve";

export default defineAgent({
  defaultTools: false,
  description:
    "Review a finished content draft with fresh context against the writing-quality rubric. Return a ready/revise verdict and concrete, quoted issues.",
  model: process.env.CORLEON_REVIEW_MODEL ?? "anthropic/claude-sonnet-5",
  tool: false,
});
