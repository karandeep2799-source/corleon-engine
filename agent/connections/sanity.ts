import { connect } from "@vercel/connect/eve";
import { defineMcpClientConnection } from "eve/connections";
import { approvalForTool } from "../lib/approval-policy.js";

const sanityConnector = process.env.SANITY_CONNECTOR ?? "sanity/corleon-copilot";

export default defineMcpClientConnection({
  approval: ({ toolName }) => approvalForTool(toolName),
  auth: connect(sanityConnector),
  description:
    "Sanity CMS: inspect schemas, query documents with GROQ, review drafts, and manage content through the authenticated user's permissions. All mutations require explicit human approval.",
  url: "https://mcp.sanity.io",
});
