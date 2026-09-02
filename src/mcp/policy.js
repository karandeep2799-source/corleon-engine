export const TOOL_POLICY = Object.freeze({
  "repo.read": "allow",
  "repo.search": "allow",
  "prisma.inspect": "allow",
  "logs.read": "allow",
  "tests.run": "allow",
  "repo.write": "approval_required",
  "db.write": "approval_required",
  "prisma.migrate": "approval_required",
  "deployment.preview": "allow",
  "deployment.production": "approval_required",
  "secrets.read": "deny",
  "production.db": "deny",
});

export function assertToolAllowed(tool, { production = false } = {}) {
  const policy = TOOL_POLICY[tool] || "deny";
  if (production && policy !== "approval_required") {
    return { allowed: false, requiresApproval: true, reason: "Production access is explicitly gated." };
  }
  return {
    allowed: policy === "allow",
    requiresApproval: policy === "approval_required",
    reason: policy === "deny" ? "Tool is not enabled by policy." : undefined,
  };
}
