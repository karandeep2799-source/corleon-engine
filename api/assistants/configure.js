import { authorizeAssistantRequest, readOrganizationId } from "../../src/assistants/auth.js";
import { configureAssistant } from "../../src/assistants/service.js";

export default async function handler(req, res) {
  if (!["POST", "PATCH"].includes(req.method)) { res.setHeader("Allow", "POST, PATCH"); return res.status(405).json({ error: "Method not allowed." }); }
  if (!authorizeAssistantRequest(req, res)) return;
  try {
    const organizationId = readOrganizationId(req);
    const { assistantId, enabled, model } = req.body || {};
    if (typeof assistantId !== "string" || !assistantId) return res.status(400).json({ error: "assistantId is required." });
    return res.status(200).json({ ok: true, assistant: await configureAssistant({ organizationId, assistantId, enabled, model }) });
  } catch (error) {
    const status = Number.isInteger(error?.statusCode) ? error.statusCode : 400;
    if (status >= 500) console.error("Assistant configuration error", error);
    return res.status(status).json({ error: status >= 500 ? "Assistant configuration failed." : error.message });
  }
}
