import type { AgentRuntimeAdapter } from "@prisma/client";

const API = "https://api.digitalocean.com/v2/agents";
const token = () => {
  const value = process.env.DIGITALOCEAN_ACCESS_TOKEN;
  if (!value) throw new Error("DIGITALOCEAN_ACCESS_TOKEN is not configured");
  return value;
};

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(API + path, {
    ...init,
    cache: "no-store",
    signal: init.signal ?? AbortSignal.timeout(30_000),
    headers: {
      Authorization: `Bearer ${token()}`,
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  if (response.status === 204) return undefined as T;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = typeof payload?.message === "string" ? payload.message : "Harness Runtime request failed";
    throw new Error(`DIGITALOCEAN_${response.status}: ${detail}`);
  }
  return payload as T;
}

export type RuntimeCreateInput = { name: string; adapter: AgentRuntimeAdapter; prompt: string; repository?: string };
const quote = (value: string) => JSON.stringify(value);

export function buildEnvironmentSpec(input: RuntimeCreateInput): string {
  const harness = { CODEX: "codex", CLAUDE_CODE: "claude-code", OPENCODE: "opencode", NONE: "none" }[input.adapter];
  if (!harness || harness === "none") throw new Error("Unsupported execution adapter");
  const keyName = input.adapter === "CLAUDE_CODE" ? "ANTHROPIC_API_KEY" : "OPENAI_API_KEY";
  const key = process.env[keyName];
  if (!key) throw new Error(`${keyName} is required to provision this adapter`);
  const name = input.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 56);
  const lines = [
    `name: ${quote(name)}`, `harness: ${harness}`, "size: mars-2vcpu-4gb", "idle_timeout: 15m", "mode: interactive",
    "egress:", "  - api.github.com", "  - github.com", "  - codeload.github.com", "  - registry.npmjs.org", "  - pypi.org",
    "  - files.pythonhosted.org", "  - api.openai.com", "  - api.anthropic.com", "secrets:", `  ${keyName}: ${quote(key)}`,
    "permissions:", "  default: ask", "  rules:", "    - tool: bash", "      action: ask", "      enforcement: strict",
    "  filesystem:", "    mode: workspace-write",
  ];
  if (input.repository) {
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(input.repository)) throw new Error("repository must use OWNER/REPO format");
    lines.push("repos:", `  - ${quote(input.repository)}`);
  }
  lines.push(
    "skills:", "  - name: corleon-task-context",
    '    description: "Use when executing a task assigned by Corleon Engine."', "    instructions: |",
    "      Work only within the provided workspace and task scope.",
    "      Clone the declared repository when it is not already present.",
    "      Never deploy, publish, spend money, modify production data, or expose secrets.",
    "      Run relevant tests and report exact commands and outcomes.",
  );
  return lines.join("\n") + "\n";
}

export async function createSession(input: RuntimeCreateInput) {
  const response = await fetch(API + "/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${token()}`, Accept: "application/json", "Content-Type": "application/x-yaml" },
    body: buildEnvironmentSpec(input), cache: "no-store", signal: AbortSignal.timeout(45_000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`DIGITALOCEAN_${response.status}: ${payload.message ?? "Session provisioning failed"}`);
  if (!payload.session?.session_id) throw new Error("DigitalOcean response did not include session.session_id");
  return { id: payload.session.session_id, name: payload.session.name, state: payload.session.status, agent_kind: payload.session.agent_kind, config_id: payload.session.config_id, region: payload.session.region };
}

export const getSession = (id: string) => call<{ session?: { session_id: string; status?: string; name?: string; agent_kind?: string; config_id?: string; region?: string } }>(`/sessions/${encodeURIComponent(id)}`);
export const sendInput = (id: string, message: string) => call<{ run_id?: string }>(`/sessions/${encodeURIComponent(id)}/input`, { method: "POST", body: JSON.stringify({ text: message }) });
export const cancelSession = (id: string) => call<{ outcome: string }>(`/sessions/${encodeURIComponent(id)}/cancel`, { method: "POST" });
export const pauseSession = (id: string) => call<unknown>(`/sessions/${encodeURIComponent(id)}/pause`, { method: "POST" });
export const resumeSession = (id: string) => call<unknown>(`/sessions/${encodeURIComponent(id)}/resume`, { method: "POST" });
export const removeSession = (id: string) => call<unknown>(`/sessions/${encodeURIComponent(id)}`, { method: "DELETE" });

export const resolveHITL = (sessionId: string, requestId: string, outcome: "HITL_OUTCOME_APPROVE" | "HITL_OUTCOME_REJECT", reason?: string) =>
  call<void>(`/sessions/${encodeURIComponent(sessionId)}/hitl/${encodeURIComponent(requestId)}`, {
    method: "POST", body: JSON.stringify({ outcome, ...(reason ? { reason } : {}) }),
  });

export async function openSessionEvents(sessionId: string, options: { cursor?: string; replayOnly?: boolean; replayFrom?: string; signal?: AbortSignal }) {
  const query = new URLSearchParams();
  if (options.cursor) query.set("cursor", options.cursor);
  if (options.replayOnly) query.set("replay_only", "true");
  if (options.replayFrom) query.set("replay_from", options.replayFrom);
  const response = await fetch(`${API}/sessions/${encodeURIComponent(sessionId)}/events?${query}`, {
    headers: { Authorization: `Bearer ${token()}`, Accept: "text/event-stream" },
    cache: "no-store", signal: options.signal,
  });
  if (!response.ok || !response.body) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(`DIGITALOCEAN_${response.status}: ${payload.message ?? "Unable to open session event stream"}`);
  }
  return response;
}
