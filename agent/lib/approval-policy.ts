/**
 * Allow a conservative set of read operations without an approval prompt.
 * Unknown or unrecognized tool names are treated as mutations and gated.
 */
const READ_ONLY_TOOL_PREFIX =
  /^(?:get|list|query|search|fetch|read|describe|inspect|validate|preview|groq|notion-search|notion-fetch|notion-get|notion-list)(?:[_-]|$)/i;

export function approvalForTool(
  qualifiedToolName: string,
): "user-approval" | "not-applicable" {
  const bareToolName = qualifiedToolName
    .slice(qualifiedToolName.lastIndexOf("__") + 2)
    .trim();

  return READ_ONLY_TOOL_PREFIX.test(bareToolName)
    ? "not-applicable"
    : "user-approval";
}
