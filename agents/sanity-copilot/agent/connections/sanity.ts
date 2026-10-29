import { connect } from "@vercel/connect/eve";
import { defineMcpClientConnection } from "eve/connections";

const connectorUid = process.env.SANITY_CONNECTOR ?? "sanity/corleon-engine";

/**
 * Only explicitly identified read operations bypass approval. Unknown tool names
 * fail closed and require a user decision before execution.
 */
const READ_ONLY_TOOL = /(^|__|_)(query|fetch|search|get_document|get_documents|get_schema|get_schemas|list_documents|list_datasets|list_schemas|inspect|describe)(_|$)/i;

export default defineMcpClientConnection({
  approval: ({ toolName }) =>
    READ_ONLY_TOOL.test(toolName) ? "not-applicable" : "user-approval",
  auth: connect(connectorUid),
  description:
    "User-scoped Sanity CMS access. Read operations are available by default; every unrecognized or mutating operation requires explicit approval.",
  url: "https://mcp.sanity.io",
});
