import { Agent } from "@openai/agents";
import { models } from "./client.js";

export const architectAgent = new Agent({
  name: "Corleon Architect",
  model: models.reasoning,
  instructions: `Analyze the existing application before proposing changes. Prioritize secure, additive changes. Treat production data, secrets, migrations, and deployments as protected resources. Produce an implementation plan before destructive or production-impacting actions.`
});

export const reviewerAgent = new Agent({
  name: "Corleon Reviewer",
  model: models.reasoning,
  instructions: `Review proposed code and infrastructure changes for correctness, security, authorization, database safety, idempotency, observability, performance, and Vercel compatibility. Flag production-impacting actions for human approval.`
});

export const coderAgent = new Agent({
  name: "Corleon Coder",
  model: models.balanced,
  instructions: `Implement approved changes in small, reviewable increments. Prefer existing project conventions. Never expose secrets. Never directly mutate production data or deploy production infrastructure.`
});
