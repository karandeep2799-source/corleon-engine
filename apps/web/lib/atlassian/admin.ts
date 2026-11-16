import { timingSafeEqual } from "node:crypto";

const ATLASSIAN_ADMIN_BASE_URL = "https://api.atlassian.com/admin";
const REQUEST_TIMEOUT_MS = 10_000;

export type AtlassianResource =
  | "organizations"
  | "organization"
  | "domains"
  | "directories"
  | "users"
  | "events"
  | "events-stream"
  | "policies";

export class AtlassianAdminError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly retryAfter?: string,
  ) {
    super(message);
    this.name = "AtlassianAdminError";
  }
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new AtlassianAdminError("Atlassian Admin integration is not configured.", 503);
  }
  return value;
}

export function isAuthorizedAtlassianRequest(request: Request): boolean {
  const expected = process.env.CORLEON_ATLASSIAN_ROUTE_TOKEN;
  const authorization = request.headers.get("authorization") ?? "";
  if (!expected || !authorization.startsWith("Bearer ")) return false;

  const supplied = authorization.slice(7);
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return (
    expectedBytes.length === suppliedBytes.length &&
    timingSafeEqual(expectedBytes, suppliedBytes)
  );
}

function safeSegment(value: string, name: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "." || trimmed === ".." || trimmed.length > 200 || /[/?#]/.test(trimmed)) {
    throw new AtlassianAdminError(`Invalid ${name}.`, 400);
  }
  return encodeURIComponent(trimmed);
}

export function buildAtlassianAdminPath(
  resource: AtlassianResource,
  options: {
    orgId?: string;
    directoryId?: string;
    cursor?: string;
    limit?: number;
  } = {},
): string {
  const orgId = options.orgId ? safeSegment(options.orgId, "organization ID") : "";
  const directoryId = options.directoryId
    ? safeSegment(options.directoryId, "directory ID")
    : "";

  if (resource === "organizations") return "/v1/orgs";
  if (!orgId) throw new AtlassianAdminError("An organization ID is required.", 400);

  const base = `/v1/orgs/${orgId}`;
  const paths: Record<Exclude<AtlassianResource, "organizations">, string> = {
    organization: base,
    domains: `${base}/domains`,
    directories: `/v2/orgs/${orgId}/directories`,
    users: `${base}/users`,
    events: `${base}/events`,
    "events-stream": `${base}/events-stream`,
    policies: `${base}/policies`,
  };

  if ((resource === "users") && options.directoryId) {
    return `/v2/orgs/${orgId}/directories/${directoryId}/users/search`;
  }
  if (options.directoryId && resource !== "users") {
    throw new AtlassianAdminError("Directory ID is only supported for directory user search.", 400);
  }
  return paths[resource];
}

export async function getAtlassianAdminResource(
  resource: AtlassianResource,
  options: {
    orgId?: string;
    directoryId?: string;
    cursor?: string;
    limit?: number;
    searchTerm?: string;
  } = {},
): Promise<unknown> {
  const apiKey = requiredEnv("ATLASSIAN_ADMIN_API_KEY");
  const path = buildAtlassianAdminPath(resource, options);
  const url = new URL(`${ATLASSIAN_ADMIN_BASE_URL}${path}`);

  if (options.cursor) url.searchParams.set("cursor", options.cursor);
  if (options.limit !== undefined) {
    if (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 500) {
      throw new AtlassianAdminError("Limit must be an integer between 1 and 500.", 400);
    }
    url.searchParams.set("limit", String(options.limit));
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    Accept: "application/json",
  };
  let method = "GET";
  let body: string | undefined;

  if (resource === "users" && options.directoryId) {
    method = "POST";
    headers["Content-Type"] = "application/json";
    body = JSON.stringify({
      ...(options.searchTerm ? { searchTerm: options.searchTerm.slice(0, 200) } : {}),
      ...(options.cursor ? { cursor: options.cursor } : {}),
      limit: options.limit ?? 50,
    });
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      ...(body ? { body } : {}),
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new AtlassianAdminError("Atlassian Admin API is temporarily unreachable.", 502);
  }

  if (response.status === 401) {
    throw new AtlassianAdminError("Atlassian rejected the configured credentials.", 502);
  }
  if (response.status === 403) {
    throw new AtlassianAdminError("The Atlassian credentials lack the required permission.", 403);
  }
  if (response.status === 429) {
    throw new AtlassianAdminError(
      "Atlassian rate limit reached. Retry after the indicated interval.",
      429,
      response.headers.get("retry-after") ?? undefined,
    );
  }
  if (!response.ok) {
    throw new AtlassianAdminError("Atlassian Admin API request failed.", 502);
  }

  if (response.status === 204) return { success: true };
  return response.json().catch(() => {
    throw new AtlassianAdminError("Atlassian returned an invalid JSON response.", 502);
  });
}
