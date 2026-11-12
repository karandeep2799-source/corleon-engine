const MUTATING_OPERATION = /(?:^|_)(?:create|update|delete|remove|publish|deploy|upload|send|schedule|run|execute|grant|revoke|set|patch|write|post|put)(?:_|$)/i;

export function parseReadOnlyToolAllowlist(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean),
  );
}

export function isReadOnlyToolAllowed(
  toolName: string,
  allowlist: ReadonlySet<string>,
): boolean {
  if (!toolName || toolName.length > 128 || !allowlist.has(toolName)) {
    return false;
  }

  const normalized = toolName.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
  return !MUTATING_OPERATION.test(normalized);
}
