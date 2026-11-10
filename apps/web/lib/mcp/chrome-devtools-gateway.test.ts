import { describe, expect, it, vi } from "vitest";
import { createChromeDevToolsGateway } from "../../../../src/mcp/chrome-devtools-gateway.js";

function createHarness(options: Record<string, unknown> = {}) {
  const requests: Record<string, unknown>[] = [];
  const events: Record<string, unknown>[] = [];
  const worker = {
    async request(message: Record<string, unknown>) {
      requests.push(message);
      if (message.method === "tools/list") {
        return {
          jsonrpc: "2.0",
          id: message.id,
          result: {
            tools: [
              { name: "take_snapshot", inputSchema: { type: "object" } },
              { name: "navigate_page", inputSchema: { type: "object" } },
              { name: "evaluate_script", inputSchema: { type: "object" } },
              { name: "new_unknown_tool", inputSchema: { type: "object" } },
            ],
          },
        };
      }
      return { jsonrpc: "2.0", id: message.id, result: { content: [{ type: "text", text: "ok" }] } };
    },
    async close() {},
  };
  const gateway = createChromeDevToolsGateway({
    identity: { tenantId: "tenant-a", actorId: "user-a", sessionId: "session-a" },
    worker,
    audit: async (event: Record<string, unknown>) => { events.push(event); },
    consumeApproval: async () => false,
    production: false,
    ...options,
  });
  return { gateway, requests, events, worker };
}

describe("Chrome DevTools MCP gateway", () => {
  it("requires a trusted tenant, actor and session identity", () => {
    const base = { worker: { request: vi.fn(), close: vi.fn() }, audit: vi.fn() };
    expect(() => createChromeDevToolsGateway(base as never)).toThrow("trusted authenticated identity");
    expect(() => createChromeDevToolsGateway({
      ...base,
      identity: { tenantId: "tenant-a", actorId: "user-a" },
    } as never)).toThrow("sessionId");
  });

  it("filters denied and unknown tools from discovery", async () => {
    const { gateway } = createHarness();
    const response = await gateway.handle({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    expect(response?.result?.tools?.map((tool: { name: string }) => tool.name)).toEqual([
      "take_snapshot",
      "navigate_page",
    ]);
  });

  it("allows an authorized read-only tool and records redacted audit events", async () => {
    const { gateway, events, requests } = createHarness();
    const response = await gateway.handle({
      jsonrpc: "2.0", id: 2, method: "tools/call",
      params: { name: "take_snapshot", arguments: { pageId: "page-1", secret: "must-not-be-audited" } },
    });
    expect(response?.result?.isError).not.toBe(true);
    expect(events.map((event) => event.action)).toEqual(["browser.tool.started", "browser.tool.completed"]);
    expect(JSON.stringify(events)).not.toContain("must-not-be-audited");
    expect(requests.at(-1)?.params).toEqual({
      name: "take_snapshot",
      arguments: { pageId: "page-1", secret: "must-not-be-audited" },
    });
  });

  it("requires a single-use approval for navigation and strips its token before forwarding", async () => {
    const consumeApproval = vi.fn(async (input: { approvalToken: string; actionDigest: string }) =>
      input.approvalToken === "valid-once" && /^[a-f0-9]{64}$/.test(input.actionDigest));
    const { gateway, requests } = createHarness({ consumeApproval });
    const response = await gateway.handle({
      jsonrpc: "2.0", id: 3, method: "tools/call",
      params: {
        name: "navigate_page",
        arguments: { url: "https://example.com" },
        _meta: { "corleon/approval-token": "valid-once" },
      },
    });
    expect(response?.result?.isError).not.toBe(true);
    expect(consumeApproval).toHaveBeenCalledOnce();
    expect(requests.at(-1)?.params).not.toHaveProperty("_meta");
  });

  it("denies approvals that do not match the exact action digest", async () => {
    const consumeApproval = vi.fn(async () => false);
    const { gateway, requests, events } = createHarness({ consumeApproval });
    const response = await gateway.handle({
      jsonrpc: "2.0", id: 4, method: "tools/call",
      params: {
        name: "navigate_page",
        arguments: { url: "https://attacker.example" },
        _meta: { "corleon/approval-token": "stale-or-mismatched" },
      },
    });
    expect(response?.result?.isError).toBe(true);
    expect(requests.some((request) => request.method === "tools/call")).toBe(false);
    expect(events.at(-1)?.action).toBe("browser.tool.approval_rejected");
  });

  it("fails closed when durable audit persistence fails", async () => {
    const worker = { request: vi.fn(), close: vi.fn() };
    const gateway = createChromeDevToolsGateway({
      identity: { tenantId: "tenant-a", actorId: "user-a", sessionId: "session-a" },
      worker,
      audit: async () => { throw new Error("database unavailable"); },
      production: false,
    });
    const response = await gateway.handle({
      jsonrpc: "2.0", id: 5, method: "tools/call",
      params: { name: "take_snapshot", arguments: {} },
    });
    expect(response?.result?.isError).toBe(true);
    expect(worker.request).not.toHaveBeenCalled();
  });

  it("denies unknown methods, malformed calls and oversized requests", async () => {
    const { gateway } = createHarness({ maxMessageBytes: 1024 });
    expect((await gateway.handle({ jsonrpc: "2.0", id: 6, method: "resources/read" }))?.error?.code).toBe(-32601);
    expect((await gateway.handle({ jsonrpc: "2.0", id: 7, method: "tools/call", params: {} }))?.error?.code).toBe(-32602);
    expect((await gateway.handle({
      jsonrpc: "2.0", id: 8, method: "tools/call",
      params: { name: "take_snapshot", arguments: { payload: "x".repeat(2000) } },
    }))?.error?.code).toBe(-32600);
  });

  it("does not execute tool calls delivered as JSON-RPC notifications", async () => {
    const { gateway, requests } = createHarness();
    expect(await gateway.handle({
      jsonrpc: "2.0", method: "tools/call",
      params: { name: "take_snapshot", arguments: {} },
    })).toBeNull();
    expect(requests.some((request) => request.method === "tools/call")).toBe(false);
  });

  it("closes the worker once and rejects subsequent requests", async () => {
    const { gateway, worker } = createHarness();
    const close = vi.spyOn(worker, "close");
    await gateway.close();
    await gateway.close();
    expect(close).toHaveBeenCalledOnce();
    expect((await gateway.handle({ jsonrpc: "2.0", id: 9, method: "ping" }))?.error?.code).toBe(-32000);
  });
});
