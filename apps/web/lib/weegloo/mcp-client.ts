export const WEEGLOO_DEFAULT_MCP_URL = "https://ai.weegloo.com/mcp";
export const MCP_PROTOCOL_VERSION = "2025-03-26";

const ALLOWED_GROUPS = new Set(["default", "core", "extra", "all"]);
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

type JsonRpcMessage = {
  jsonrpc?: string;
  id?: string | number;
  result?: unknown;
  error?: { code?: number; message?: string; data?: unknown };
};

type McpSession = {
  sessionId?: string;
  protocolVersion: string;
};

export class WeeglooMcpError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 502,
  ) {
    super(message);
    this.name = "WeeglooMcpError";
  }
}

export function resolveWeeglooEndpoint(value = WEEGLOO_DEFAULT_MCP_URL): string {
  let endpoint: URL;

  try {
    endpoint = new URL(value);
  } catch {
    throw new WeeglooMcpError("Invalid WEEGLOO MCP endpoint.", 500);
  }

  if (
    endpoint.protocol !== "https:" ||
    endpoint.hostname !== "ai.weegloo.com" ||
    endpoint.port ||
    endpoint.username ||
    endpoint.password ||
    endpoint.pathname !== "/mcp"
  ) {
    throw new WeeglooMcpError("WEEGLOO MCP endpoint must use https://ai.weegloo.com/mcp.", 500);
  }

  for (const key of endpoint.searchParams.keys()) {
    if (key !== "group") {
      throw new WeeglooMcpError("Unsupported WEEGLOO MCP endpoint query parameter.", 500);
    }
  }

  const group = endpoint.searchParams.get("group");
  if (group && !ALLOWED_GROUPS.has(group)) {
    throw new WeeglooMcpError("Unsupported WEEGLOO MCP tool group.", 500);
  }

  return endpoint.toString();
}

function parseJson(text: string): JsonRpcMessage {
  try {
    return JSON.parse(text) as JsonRpcMessage;
  } catch {
    throw new WeeglooMcpError("WEEGLOO returned an invalid MCP response.");
  }
}

async function readJsonRpcResponse(
  response: Response,
  expectedId: string | number,
): Promise<JsonRpcMessage> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("text/event-stream")) {
    if (!response.body) {
      throw new WeeglooMcpError("WEEGLOO returned an empty event stream.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let totalBytes = 0;

    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;

        totalBytes += chunk.value.byteLength;
        if (totalBytes > MAX_RESPONSE_BYTES) {
          throw new WeeglooMcpError("WEEGLOO MCP response exceeded the size limit.", 502);
        }

        buffer += decoder.decode(chunk.value, { stream: true });

        let boundary = buffer.search(/\r?\n\r?\n/);
        while (boundary !== -1) {
          const event = buffer.slice(0, boundary);
          const separator = buffer.slice(boundary).match(/^\r?\n\r?\n/)?.[0] ?? "\n\n";
          buffer = buffer.slice(boundary + separator.length);

          const data = event
            .split(/\r?\n/)
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trim())
            .join("\n");

          if (data && data !== "[DONE]") {
            const message = parseJson(data);
            if (message.id === expectedId) return message;
          }

          boundary = buffer.search(/\r?\n\r?\n/);
        }
      }
    } finally {
      await reader.cancel().catch(() => undefined);
    }

    throw new WeeglooMcpError("WEEGLOO event stream ended without the expected response.");
  }

  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES) {
    throw new WeeglooMcpError("WEEGLOO MCP response exceeded the size limit.", 502);
  }
  if (!text) {
    throw new WeeglooMcpError("WEEGLOO returned an empty MCP response.");
  }

  const message = parseJson(text);
  if (message.id !== expectedId) {
    throw new WeeglooMcpError("WEEGLOO MCP response ID did not match the request.");
  }
  return message;
}

export type WeeglooMcpClientOptions = {
  accessToken: string;
  endpoint?: string;
  fetchImpl?: typeof fetch;
};

export class WeeglooMcpClient {
  private readonly endpoint: string;
  private readonly accessToken: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: WeeglooMcpClientOptions) {
    if (!options.accessToken || /[\r\n]/.test(options.accessToken)) {
      throw new WeeglooMcpError("A valid WEEGLOO OAuth access token is required.", 401);
    }

    this.endpoint = resolveWeeglooEndpoint(options.endpoint);
    this.accessToken = options.accessToken;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private async post(
    payload: Record<string, unknown>,
    session?: McpSession,
    expectedId?: string | number,
  ): Promise<{ message?: JsonRpcMessage; session: McpSession }> {
    const headers = new Headers({
      Accept: "application/json, text/event-stream",
      Authorization: "Bearer " + this.accessToken,
      "Content-Type": "application/json",
      "MCP-Protocol-Version": session?.protocolVersion ?? MCP_PROTOCOL_VERSION,
    });

    if (session?.sessionId) {
      headers.set("Mcp-Session-Id", session.sessionId);
    }

    let response: Response;
    try {
      response = await this.fetchImpl(this.endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        cache: "no-store",
      });
    } catch {
      throw new WeeglooMcpError("Unable to reach the WEEGLOO MCP service.");
    }

    if (response.status === 401 || response.status === 403) {
      throw new WeeglooMcpError("WEEGLOO OAuth authorization failed or expired.", 401);
    }
    if (!response.ok && response.status !== 202) {
      throw new WeeglooMcpError("WEEGLOO MCP request failed with status " + response.status + ".");
    }

    const nextSession: McpSession = {
      sessionId: response.headers.get("Mcp-Session-Id") ?? session?.sessionId,
      protocolVersion: session?.protocolVersion ?? MCP_PROTOCOL_VERSION,
    };

    if (expectedId === undefined || response.status === 202) {
      return { session: nextSession };
    }

    const message = await readJsonRpcResponse(response, expectedId);
    if (message.error) {
      throw new WeeglooMcpError(
        "WEEGLOO MCP error (" + String(message.error.code ?? "unknown") + "): " +
          String(message.error.message ?? "Request failed."),
      );
    }

    return { message, session: nextSession };
  }

  private async initialize(): Promise<McpSession> {
    const initialized = await this.post(
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: "corleon-engine", version: "1.0.0" },
        },
      },
      undefined,
      1,
    );

    const result = initialized.message?.result as
      | { protocolVersion?: string }
      | undefined;
    const session: McpSession = {
      sessionId: initialized.session.sessionId,
      protocolVersion: result?.protocolVersion ?? MCP_PROTOCOL_VERSION,
    };

    await this.post(
      { jsonrpc: "2.0", method: "notifications/initialized" },
      session,
    );

    return session;
  }

  async listTools(cursor?: string): Promise<unknown> {
    if (cursor !== undefined && (cursor.length > 512 || /[\r\n]/.test(cursor))) {
      throw new WeeglooMcpError("Invalid MCP pagination cursor.", 400);
    }

    const session = await this.initialize();
    const params = cursor ? { cursor } : {};
    const response = await this.post(
      { jsonrpc: "2.0", id: 2, method: "tools/list", params },
      session,
      2,
    );

    return response.message?.result ?? {};
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    if (!name || name.length > 128) {
      throw new WeeglooMcpError("Invalid WEEGLOO tool name.", 400);
    }

    const session = await this.initialize();
    const response = await this.post(
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name, arguments: args },
      },
      session,
      2,
    );

    return response.message?.result ?? {};
  }
}
