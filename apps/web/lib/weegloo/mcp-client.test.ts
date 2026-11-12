import { describe, expect, it, vi } from "vitest";
import {
  MCP_PROTOCOL_VERSION,
  WeeglooMcpClient,
  WeeglooMcpError,
  resolveWeeglooEndpoint,
} from "./mcp-client";

describe("WEEGLOO MCP client", () => {
  it("accepts only the documented HTTPS MCP host and path", () => {
    expect(resolveWeeglooEndpoint()).toBe("https://ai.weegloo.com/mcp");
    expect(resolveWeeglooEndpoint("https://ai.weegloo.com/mcp?group=core"))
      .toBe("https://ai.weegloo.com/mcp?group=core");
  });

  it("rejects non-WEEGLOO hosts and unsupported query parameters", () => {
    expect(() => resolveWeeglooEndpoint("https://evil.example/mcp")).toThrow(WeeglooMcpError);
    expect(() => resolveWeeglooEndpoint("https://ai.weegloo.com/mcp?redirect=https://evil.example"))
      .toThrow(WeeglooMcpError);
    expect(() => resolveWeeglooEndpoint("http://ai.weegloo.com/mcp")).toThrow(WeeglooMcpError);
  });

  it("performs the MCP initialize handshake before listing tools", async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        result: {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: { name: "weegloo", version: "test" },
        },
      }), {
        status: 200,
        headers: { "content-type": "application/json", "Mcp-Session-Id": "session-test" },
      }))
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        result: { tools: [{ name: "cma_ListSpaces", description: "List spaces" }] },
      }), { status: 200, headers: { "content-type": "application/json" } }));

    const client = new WeeglooMcpClient({
      accessToken: "test-oauth-token",
      fetchImpl: fetchMock,
    });

    const result = await client.listTools();
    expect(result).toEqual({
      tools: [{ name: "cma_ListSpaces", description: "List spaces" }],
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const initializeHeaders = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(initializeHeaders.get("authorization")).toBe("Bearer test-oauth-token");

    const listHeaders = new Headers(fetchMock.mock.calls[2][1]?.headers);
    expect(listHeaders.get("mcp-session-id")).toBe("session-test");
  });
});
