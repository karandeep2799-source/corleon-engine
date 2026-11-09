import type { AgentRuntimeAdapter } from "@prisma/client";

export type RuntimeCreateInput = { name: string; adapter: AgentRuntimeAdapter; prompt: string; repository?: string };
export type RuntimeSessionSnapshot = { session_id: string; status?: string; name?: string; agent_kind?: string; config_id?: string; region?: string };

export interface AgentRuntimeProvider {
  readonly id: "digitalocean" | "vercel-sandbox";
  createSession(input: RuntimeCreateInput): Promise<{ id: string; name?: string; state?: string; agent_kind?: string; config_id?: string; region?: string }>;
  getSession(sessionId: string): Promise<{ session?: RuntimeSessionSnapshot }>;
  sendInput(sessionId: string, message: string): Promise<{ run_id?: string }>;
  cancel(sessionId: string): Promise<{ outcome: string }>;
  pause(sessionId: string): Promise<unknown>;
  resume(sessionId: string): Promise<unknown>;
  remove(sessionId: string): Promise<unknown>;
  resolveHITL(sessionId: string, requestId: string, outcome: "HITL_OUTCOME_APPROVE" | "HITL_OUTCOME_REJECT", reason?: string): Promise<void>;
  openSessionEvents(sessionId: string, options: { cursor?: string; replayOnly?: boolean; replayFrom?: string; signal?: AbortSignal }): Promise<Response>;
}
