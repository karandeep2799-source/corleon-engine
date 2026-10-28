import { authorizeAssistantRequest, readOrganizationId } from "../../src/assistants/auth.js";
import { listAssistantRuns } from "../../src/assistants/service.js";

export default async function handler(req, res) {
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).json({ error: "Method not allowed." }); }
  if (!authorizeAssistantRequest(req, res)) return;
  try {
    const organizationId = readOrganizationId(req);
    const rawLimit = req.query?.limit;
    const limit = rawLimit === undefined ? 25 : Number(rawLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) return res.status(400).json({ error: "limit must be an integer from 1 to 100." });
    const runs = await listAssistantRuns({ organizationId, limit });
    return res.status(200).json({ runs });
  } catch (error) {
    const status = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
    if (status >= 500) console.error("Assistant run history error", error);
    return res.status(status).json({ error: status >= 500 ? "Unable to retrieve assistant runs." : error.message });
  }
}
