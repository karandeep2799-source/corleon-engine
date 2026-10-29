import { connect } from "@vercel/connect/eve";
import { defineMcpClientConnection } from "eve/connections";

const connectorUid = process.env.NOTION_CONNECTOR ?? "notion/corleon-engine";

/**
 * Notion search and retrieval are read-only. Page creation, edits, moves,
 * database changes, and unknown operations require explicit user approval.
 */
const READ_ONLY_TOOL = /(^|__|-|_)(search|retrieve|get|list|fetch)(_|-|$)/i;

export default defineMcpClientConnection({
  approval: ({ toolName }) =>
    READ_ONLY_TOOL.test(toolName) ? "not-applicable" : "user-approval",
  auth: connect(connectorUid),
  description:
    "User-scoped Notion access. Search and retrieval are available by default; mutations and unknown operations require explicit approval.",
  url: "https://mcp.notion.com/mcp",
});
