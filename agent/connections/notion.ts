import { connect } from "@vercel/connect/eve";
import { defineMcpClientConnection } from "eve/connections";
import { approvalForTool } from "../lib/approval-policy.js";

const notionConnector = process.env.NOTION_CONNECTOR ?? "notion/corleon-copilot";

export default defineMcpClientConnection({
  approval: ({ toolName }) => approvalForTool(toolName),
  auth: connect(notionConnector),
  description:
    "Notion workspace: search and read pages and databases, and prepare content drafts. All page creation, edits, moves, and other mutations require explicit human approval.",
  url: "https://mcp.notion.com/mcp",
});
