import "server-only";

const API_BASE = "https://agent.tinyfish.ai";
const API_KEY = process.env.TINYFISH_API_KEY;

export type TinyFishAction =
  | "agent.run"
  | "search.query"
  | "fetch.contents"
  | "research.run"
  | "wallet.get"
  | "monitors.list"
  | "monitors.create"
  | "monitors.get"
  | "monitors.update"
  | "monitors.run"
  | "monitors.delete"
  | "datasets.list"
  | "datasets.plan"
  | "datasets.create"
  | "datasets.get"
  | "datasets.rows"
  | "datasets.populate"
  | "datasets.cancel"
  | "datasets.delete"
  | "profiles.list"
  | "profiles.create"
  | "profiles.setup"
  | "profiles.save";

type JsonObject = Record<string, unknown>;

export class TinyFishError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "TinyFishError";
  }
}

function assertConfigured(): string {
  if (!API_KEY) {
    throw new TinyFishError("TinyFish is not configured. Set TINYFISH_API_KEY in the server environment.", 503, "NOT_CONFIGURED");
  }
  return API_KEY;
}

function assertPublicHttpUrl(value: unknown): string {
  if (typeof value !== "string" || value.length > 2048) {
    throw new TinyFishError("A valid target URL is required.", 400, "INVALID_URL");
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new TinyFishError("The target URL is invalid.", 400, "INVALID_URL");
  }
  const host = url.hostname.toLowerCase();
  if (!["http:", "https:"].includes(url.protocol) ||
      host === "localhost" ||
      host.endsWith(".localhost") ||
      host.endsWith(".local") ||
      host === "0.0.0.0" ||
      host === "::1" ||
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^169\.254\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host)) {
    throw new TinyFishError("Only public HTTP or HTTPS websites can be automated.", 400, "URL_NOT_ALLOWED");
  }
  return url.toString();
}

function requireId(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) {
    throw new TinyFishError(`A valid ${label} is required.`, 400, "INVALID_ID");
  }
  return value;
}

function objectInput(value: unknown): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TinyFishError("The input field must be a JSON object.", 400, "INVALID_INPUT");
  }
  return value as JsonObject;
}

async function tinyFishRequest(
  path: string,
  method: string,
  body?: JsonObject,
  accept = "application/json",
  baseUrl = API_BASE,
): Promise<Response> {
  const key = assertConfigured();
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "X-API-Key": key,
      Accept: accept,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
    signal: AbortSignal.timeout(150_000),
  });

  if (!response.ok) {
    const raw = await response.text();
    let parsed: unknown = raw;
    try { parsed = JSON.parse(raw); } catch { /* retain provider text */ }
    const record = parsed && typeof parsed === "object" ? parsed as JsonObject : {};
    const error = record.error && typeof record.error === "object" ? record.error as JsonObject : {};
    throw new TinyFishError(
      typeof error.message === "string" ? error.message : `TinyFish request failed (${response.status}).`,
      response.status,
      typeof error.code === "string" ? error.code : "PROVIDER_ERROR",
      parsed,
    );
  }
  return response;
}

async function jsonRequest(path: string, method: string, body?: JsonObject, baseUrl = API_BASE) {
  const response = await tinyFishRequest(path, method, body, "application/json", baseUrl);
  if (response.status === 204) return { success: true };
  const text = await response.text();
  if (!text) return { success: true };
  try { return JSON.parse(text) as unknown; }
  catch { throw new TinyFishError("TinyFish returned an invalid JSON response.", 502, "INVALID_PROVIDER_RESPONSE"); }
}

export async function executeTinyFishAction(action: TinyFishAction, rawInput: unknown): Promise<Response | unknown> {
  const input = objectInput(rawInput);

  switch (action) {
    case "agent.run": {
      const url = assertPublicHttpUrl(input.url);
      if (typeof input.goal !== "string" || input.goal.trim().length < 5 || input.goal.length > 12000) {
        throw new TinyFishError("A goal between 5 and 12,000 characters is required.", 400, "INVALID_GOAL");
      }
      const body: JsonObject = { url, goal: input.goal.trim() };
      if (input.output_schema && typeof input.output_schema === "object") body.output_schema = input.output_schema;
      if (input.use_profile === true) body.use_profile = true;
      if (input.use_profile === true && typeof input.profile_id === "string") body.profile_id = requireId(input.profile_id, "profile ID");
      if (input.use_vault === true) body.use_vault = true;
      if (input.browser_profile === "lite" || input.browser_profile === "stealth") body.browser_profile = input.browser_profile;
      if (input.agent_config && typeof input.agent_config === "object") body.agent_config = input.agent_config;
      const response = await tinyFishRequest("/v1/automation/run-sse", "POST", body, "text/event-stream");
      return new Response(response.body, {
        status: response.status,
        headers: {
          "Content-Type": response.headers.get("content-type") ?? "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          "X-Accel-Buffering": "no",
        },
      });
    }
    case "search.query": {
      if (typeof input.query !== "string" || !input.query.trim() || input.query.length > 2000) {
        throw new TinyFishError("A search query is required (maximum 2,000 characters).", 400, "INVALID_QUERY");
      }
      const params = new URLSearchParams({ query: input.query.trim() });
      for (const key of ["purpose", "location", "language", "include_domains", "exclude_domains", "domain_type", "after_date", "before_date", "recency_minutes", "pub_year_min", "pub_year_max", "page"] as const) {
        if (input[key] !== undefined) params.set(key, String(input[key]));
      }
      const response = await tinyFishRequest(`/?${params.toString()}`, "GET", undefined, "application/json", "https://api.search.tinyfish.ai");
      const text = await response.text();
      try { return JSON.parse(text) as unknown; }
      catch { throw new TinyFishError("TinyFish Search returned an invalid JSON response.", 502, "INVALID_PROVIDER_RESPONSE"); }
    }
    case "fetch.contents": {
      if (!Array.isArray(input.urls) || input.urls.length < 1 || input.urls.length > 10) {
        throw new TinyFishError("Provide between 1 and 10 URLs.", 400, "INVALID_URLS");
      }
      const urls = input.urls.map(assertPublicHttpUrl);
      const body: JsonObject = { urls, format: input.format === "html" || input.format === "json" ? input.format : "markdown" };
      for (const key of ["purpose", "links", "image_links", "iframe_links", "page_metadata", "ttl", "per_url_timeout_ms", "include_etag_and_last_modified", "include_selectors", "exclude_selectors"] as const) {
        if (input[key] !== undefined) body[key] = input[key];
      }
      return jsonRequest("/", "POST", body, "https://api.fetch.tinyfish.ai");
    }
    case "research.run": {
      if (typeof input.query !== "string" || input.query.trim().length < 5 || input.query.length > 10000) {
        throw new TinyFishError("A research question between 5 and 10,000 characters is required.", 400, "INVALID_QUERY");
      }
      const body: JsonObject = { query: input.query.trim(), mode: input.mode === "max" ? "max" : "deep" };
      if (input.domain_filter && typeof input.domain_filter === "object") body.domain_filter = input.domain_filter;
      const response = await tinyFishRequest("/v1/automation/run-research", "POST", body, "text/event-stream");
      return new Response(response.body, {
        status: response.status,
        headers: {
          "Content-Type": response.headers.get("content-type") ?? "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          "X-Accel-Buffering": "no",
          ...(response.headers.get("x-research-run-id") ? { "X-Research-Run-Id": response.headers.get("x-research-run-id")! } : {}),
        },
      });
    }
    case "wallet.get":
      return jsonRequest("/v1/wallet", "GET");

    case "monitors.list":
      return jsonRequest("/v1/monitors", "GET");
    case "monitors.create": {
      const body = objectInput(input);
      if (body.type !== "fetch" && body.type !== "search") throw new TinyFishError("Monitor type must be fetch or search.", 400, "INVALID_MONITOR");
      if (typeof body.schedule_cron !== "string" || !body.schedule_cron.trim()) throw new TinyFishError("A cron schedule is required.", 400, "INVALID_SCHEDULE");
      const config = objectInput(body.config);
      if (body.type === "fetch") config.url = assertPublicHttpUrl(config.url);
      if (body.type === "search" && (typeof config.query !== "string" || !config.query.trim())) throw new TinyFishError("A monitor search query is required.", 400, "INVALID_QUERY");
      return jsonRequest("/v1/monitors", "POST", { ...body, config });
    }
    case "monitors.get": {
      const id = requireId(input.monitor_id, "monitor ID");
      return jsonRequest(`/v1/monitors/${id}`, "GET");
    }
    case "monitors.update": {
      const id = requireId(input.monitor_id, "monitor ID");
      const { monitor_id: _id, ...body } = input;
      return jsonRequest(`/v1/monitors/${id}`, "PATCH", body);
    }
    case "monitors.run": {
      const id = requireId(input.monitor_id, "monitor ID");
      return jsonRequest(`/v1/monitors/${id}/runs`, "POST", {});
    }
    case "monitors.delete": {
      const id = requireId(input.monitor_id, "monitor ID");
      return jsonRequest(`/v1/monitors/${id}`, "DELETE");
    }

    case "datasets.list":
      return jsonRequest("/v1/datasets", "GET");
    case "datasets.plan": {
      if (typeof input.prompt !== "string" || input.prompt.trim().length < 3 || input.prompt.length > 15000) throw new TinyFishError("A dataset prompt is required.", 400, "INVALID_PROMPT");
      return jsonRequest("/v1/datasets/plan", "POST", { prompt: input.prompt.trim() });
    }
    case "datasets.create": {
      if (typeof input.prompt !== "string" || input.prompt.trim().length < 3 || input.prompt.length > 15000) throw new TinyFishError("A dataset prompt is required.", 400, "INVALID_PROMPT");
      const rows = typeof input.target_rows === "number" ? Math.min(250, Math.max(1, Math.floor(input.target_rows))) : 100;
      return jsonRequest("/v1/datasets", "POST", { prompt: input.prompt.trim(), target_rows: rows });
    }
    case "datasets.get": {
      const id = requireId(input.dataset_id, "dataset ID");
      return jsonRequest(`/v1/datasets/${id}`, "GET");
    }
    case "datasets.rows": {
      const id = requireId(input.dataset_id, "dataset ID");
      const params = new URLSearchParams();
      if (typeof input.limit === "number") params.set("limit", String(Math.min(500, Math.max(1, Math.floor(input.limit)))));
      if (typeof input.after === "string" && input.after.length <= 32) params.set("after", input.after);
      return jsonRequest(`/v1/datasets/${id}/rows${params.size ? `?${params}` : ""}`, "GET");
    }
    case "datasets.populate": {
      const id = requireId(input.dataset_id, "dataset ID");
      const body: JsonObject = {};
      if (typeof input.target_rows === "number") body.target_rows = Math.min(250, Math.max(1, Math.floor(input.target_rows)));
      if (input.reset === true) body.reset = true;
      return jsonRequest(`/v1/datasets/${id}/populate`, "POST", body);
    }
    case "datasets.cancel": {
      const id = requireId(input.dataset_id, "dataset ID");
      const runId = requireId(input.run_id, "run ID");
      return jsonRequest(`/v1/datasets/${id}/runs/${runId}/cancel`, "POST", {});
    }
    case "datasets.delete": {
      const id = requireId(input.dataset_id, "dataset ID");
      return jsonRequest(`/v1/datasets/${id}`, "DELETE");
    }

    case "profiles.list":
      return jsonRequest("/v1/profiles", "GET");
    case "profiles.create": {
      if (typeof input.name !== "string" || !input.name.trim() || input.name.length > 100) throw new TinyFishError("A profile name is required.", 400, "INVALID_PROFILE");
      const body: JsonObject = { name: input.name.trim() };
      if (input.set_as_default === true) body.set_as_default = true;
      if (typeof input.url === "string") body.url = assertPublicHttpUrl(input.url);
      if (typeof input.proxy_country_code === "string") body.proxy_country_code = input.proxy_country_code;
      return jsonRequest("/v1/profiles", "POST", body);
    }
    case "profiles.setup": {
      const id = requireId(input.profile_id, "profile ID");
      const body: JsonObject = {};
      if (typeof input.url === "string") body.url = assertPublicHttpUrl(input.url);
      return jsonRequest(`/v1/profiles/${id}/setup-session`, "POST", body);
    }
    case "profiles.save": {
      const id = requireId(input.profile_id, "profile ID");
      if (typeof input.session_id !== "string" || !input.session_id.trim()) throw new TinyFishError("A setup session ID is required.", 400, "INVALID_SESSION");
      const body: JsonObject = { session_id: input.session_id };
      if (Array.isArray(input.signed_in_sites)) body.signed_in_sites = input.signed_in_sites.filter((site): site is string => typeof site === "string").slice(0, 20);
      return jsonRequest(`/v1/profiles/${id}/save`, "POST", body);
    }
    default:
      throw new TinyFishError("Unsupported TinyFish action.", 400, "UNSUPPORTED_ACTION");
  }
}
