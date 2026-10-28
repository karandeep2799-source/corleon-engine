import { authorizeAssistantRequest, readOrganizationId } from "../../src/assistants/auth.js";
import { getAssistantCatalog, listOrganizationAssistants, runAssistant } from "../../src/assistants/service.js";

export default async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) { res.setHeader("Allow", "GET, POST"); return res.status(405).json({ error: "Method not allowed." }); }
  if (!authorizeAssistantRequest(req, res)) return;
  try {
    const organizationId = readOrganizationId(req);
    if (req.method === "GET") return res.status(200).json({ assistants: await listOrganizationAssistants(organizationId), catalog: getAssistantCatalog() });
    const { assistantId, input } = req.body || {};
    return res.status(200).json({ ok: true, ...await runAssistant({ organizationId, assistantId, input }) });
  } catch (error) {
    const status = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
    if (status >= 500) console.error("Assistant API error", error);
    return res.status(status).json({ error: status >= 500 ? "Assistant request failed." : error.message, ...(error?.details ? { details: error.details } : {}) });
  }
}
