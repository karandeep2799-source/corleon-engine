import { timingSafeEqual } from "node:crypto";

export function authorizeAssistantRequest(req, res) {
  const expected = process.env.CORLEON_ASSISTANTS_API_KEY;
  if (!expected) { res.status(503).json({ error: "Assistant API is disabled: CORLEON_ASSISTANTS_API_KEY is missing." }); return false; }
  const header = req.headers.authorization || "";
  const supplied = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(supplied); const b = Buffer.from(expected);
  if (!a.length || a.length !== b.length || !timingSafeEqual(a, b)) { res.status(401).json({ error: "Unauthorized." }); return false; }
  return true;
}
export function readOrganizationId(req) {
  const value = req.body?.organizationId ?? req.query?.organizationId ?? req.headers["x-organization-id"];
  if (typeof value !== "string" || !value.trim() || value.length > 128) { const error = new Error("organizationId is required."); error.statusCode = 400; throw error; }
  return value.trim();
}
