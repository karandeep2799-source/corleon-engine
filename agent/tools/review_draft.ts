import { defineWorkflowTool } from "eve/tools";
import { z } from "zod";
import { serveSubagentTask, subagentMessageInput } from "../lib/subagent-task.js";

const reviewVerdict = z.strictObject({
  issues: z.array(z.strictObject({
    fix: z.string().describe("A concrete suggested change."),
    quote: z.string().describe("The exact offending excerpt from the draft."),
    rule: z.string().describe("The writing-quality rule the excerpt breaks."),
    severity: z.enum(["high", "medium", "low"]),
  })),
  verdict: z.enum(["ready", "revise"]),
});

export default defineWorkflowTool({
  description:
    "Review a finished draft with fresh context against the writing-quality rubric. Pass the complete draft, audience, and voice constraints in message. Returns a ready/revise verdict with quoted issues and concrete fixes.",
  inputSchema: subagentMessageInput,
  outputSchema: reviewVerdict,
  async serve(receive, ctx) {
    "use workflow";
    return await serveSubagentTask(receive, ctx, "reviewer", reviewVerdict);
  },
});
