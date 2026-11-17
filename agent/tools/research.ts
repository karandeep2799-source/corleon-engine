import { defineWorkflowTool } from "eve/tools";
import { z } from "zod";
import { serveSubagentTask, subagentMessageInput } from "../lib/subagent-task.js";

const source = z.strictObject({
  title: z.string().describe("The source title or publication name."),
  url: z.string().url().describe("The real source URL, as visited."),
});

const researchResult = z.strictObject({
  findings: z.array(z.strictObject({
    claim: z.string().describe("One specific factual claim."),
    confidence: z.enum(["high", "medium", "low"]),
    notes: z.string().describe("Caveats, date sensitivity, scope limits, or disagreements."),
    sources: z.array(source).min(1),
  })),
  gaps: z.array(z.string()).describe("Claims or questions that could not be verified."),
  summary: z.string().describe("A concise synthesis of what the research establishes."),
});

export default defineWorkflowTool({
  description:
    "Research external facts, statistics, primary sources, and claims. Returns cited findings with confidence levels and verification gaps. Pass the full question, context, and recency constraints in message.",
  inputSchema: subagentMessageInput,
  outputSchema: researchResult,
  async serve(receive, ctx) {
    "use workflow";
    return await serveSubagentTask(receive, ctx, "researcher", researchResult);
  },
});
