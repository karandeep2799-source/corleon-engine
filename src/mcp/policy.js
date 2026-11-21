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

  // Chrome DevTools MCP: diagnostics are permitted only in scoped,
  // non-production sessions; actions require explicit approval.
  "browser.pages.read": "allow",
  "browser.snapshot.read": "allow",
  "browser.screenshot.read": "allow",
  "browser.console.read": "allow",
  "browser.styles.read": "allow",
  "browser.network.read": "allow",
  "browser.performance.read": "allow",
  "browser.pwa.read": "allow",
  "browser.third_party.read": "deny",
  "browser.webmcp.read": "deny",
  "browser.navigation.navigate": "approval_required",
  "browser.input.interact": "approval_required",
  "browser.memory.inspect": "approval_required",
  "browser.pwa.manage": "approval_required",
  "browser.webauthn.manage": "approval_required",
  "browser.file.upload": "deny",
  "browser.script.evaluate": "deny",
  "browser.extensions.read": "deny",
  "browser.extensions.manage": "deny",
  "browser.third_party.execute": "deny",
  "browser.webmcp.execute": "deny",
});

export function assertToolAllowed(tool, { production = false } = {}) {
  // Deny is absolute: production mode must never upgrade a denied capability
  // into an approval-gated capability.
  const policy = Object.hasOwn(TOOL_POLICY, tool) ? TOOL_POLICY[tool] : "deny";
  if (policy === "deny") {
    return { allowed: false, requiresApproval: false, reason: "Tool is not enabled by policy." };
  }
  if (policy === "approval_required") {
    return { allowed: false, requiresApproval: true, reason: "Explicit approval is required." };
  }
  if (production) {
    return { allowed: false, requiresApproval: true, reason: "Production access requires explicit approval." };
  }
  return { allowed: true, requiresApproval: false };
}
