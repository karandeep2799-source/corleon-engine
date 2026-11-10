import { createHash, randomUUID } from "node:crypto";
import { authorizeChromeDevToolsTool } from "./chrome-devtools.js";

const JSON_RPC_VERSION = "2.0";
const APPROVAL_META_KEY = "corleon/approval-token";
const DEFAULT_MAX_MESSAGE_BYTES = 1024 * 1024;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function boundedString(value, label) {
  if (typeof value !== "string" || value.length < 1 || value.length > 256) {
    throw new TypeError(`Trusted identity ${label} must be a non-empty string of at most 256 characters.`);
  }
  return value;
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function actionDigest(toolName, args) {
  return createHash("sha256")
    .update(stableJson({ toolName, arguments: args ?? {} }))
    .digest("hex");
}

function rpcError(id, code, message) {
  return { jsonrpc: JSON_RPC_VERSION, id: id ?? null, error: { code, message } };
}

function toolError(message) {
  return {
    jsonrpc: JSON_RPC_VERSION,
    result: {
      content: [{ type: "text", text: message }],
      isError: true,
    },
  };
}

function responseSize(value) {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

/**
 * Create a policy-enforcing MCP gateway around one already-provisioned worker.
 *
 * Authentication and worker provisioning deliberately live outside this module:
 * the host must authenticate the caller, derive identity server-side, and supply
 * a fresh isolated worker. The worker must never be exposed directly to clients.
 */
export function createChromeDevToolsGateway({
  identity,
  worker,
  audit,
  consumeApproval,
  authorize = authorizeChromeDevToolsTool,
  production = true,
  maxMessageBytes = DEFAULT_MAX_MESSAGE_BYTES,
} = {}) {
  if (!isRecord(identity)) throw new TypeError("A trusted authenticated identity is required.");
  const trustedIdentity = Object.freeze({
    tenantId: boundedString(identity.tenantId, "tenantId"),
    actorId: boundedString(identity.actorId, "actorId"),
    sessionId: boundedString(identity.sessionId, "sessionId"),
  });
  if (!worker || typeof worker.request !== "function" || typeof worker.close !== "function") {
    throw new TypeError("worker must implement request(message) and close().");
  }
  if (typeof audit !== "function") throw new TypeError("An append-only audit adapter is required.");
  if (consumeApproval !== undefined && typeof consumeApproval !== "function") {
    throw new TypeError("consumeApproval must be a function.");
  }
  if (!Number.isSafeInteger(maxMessageBytes) || maxMessageBytes < 1024 || maxMessageBytes > 10 * 1024 * 1024) {
    throw new RangeError("maxMessageBytes must be between 1024 and 10485760.");
  }

  let closed = false;

  async function writeAudit(event) {
    // Audit failure is fail-closed: no protected browser action proceeds.
    await audit(Object.freeze({
      eventId: randomUUID(),
      occurredAt: new Date().toISOString(),
      tenantId: trustedIdentity.tenantId,
      actorId: trustedIdentity.actorId,
      sessionId: trustedIdentity.sessionId,
      ...event,
    }));
  }

  async function decisionFor(toolName) {
    try {
      const decision = await authorize(toolName, { production });
      if (!isRecord(decision)) return { allowed: false, requiresApproval: false };
      return {
        allowed: decision.allowed === true,
        requiresApproval: decision.requiresApproval === true,
        reason: typeof decision.reason === "string" ? decision.reason : undefined,
      };
    } catch {
      return { allowed: false, requiresApproval: false };
    }
  }

  async function handle(message) {
    if (closed) return rpcError(message?.id, -32000, "Browser session is closed.");
    if (!isRecord(message) || message.jsonrpc !== JSON_RPC_VERSION || typeof message.method !== "string") {
      return rpcError(message?.id, -32600, "Invalid JSON-RPC request.");
    }
    if (responseSize(message) > maxMessageBytes) {
      return rpcError(message.id, -32600, "Request exceeds the configured message limit.");
    }

    // Notifications may not invoke tools or trigger browser side effects.
    if (!Object.hasOwn(message, "id")) {
      if (message.method === "notifications/initialized") {
        try {
          await worker.request(message);
        } catch {
          await writeAudit({ action: "worker.notification.failed", outcome: "error" }).catch(() => {});
        }
      }
      return null;
    }

    if (message.method === "initialize" || message.method === "ping") {
      try {
        const result = await worker.request(message);
        if (result && responseSize(result) <= maxMessageBytes) return result;
        return rpcError(message.id, -32603, "Invalid or oversized worker response.");
      } catch {
        return rpcError(message.id, -32603, "Browser worker request failed.");
      }
    }

    if (message.method === "tools/list") {
      try {
        const upstream = await worker.request(message);
        const tools = upstream?.result?.tools;
        if (!Array.isArray(tools)) return rpcError(message.id, -32603, "Worker returned an invalid tool list.");
        const visible = [];
        for (const tool of tools) {
          if (!isRecord(tool) || typeof tool.name !== "string") continue;
          const decision = await decisionFor(tool.name);
          if (decision.allowed || decision.requiresApproval) visible.push(tool);
        }
        const filtered = {
          ...upstream,
          result: { ...upstream.result, tools: visible },
        };
        if (responseSize(filtered) > maxMessageBytes) return rpcError(message.id, -32603, "Worker response exceeds the configured message limit.");
        return filtered;
      } catch {
        return rpcError(message.id, -32603, "Unable to list browser tools.");
      }
    }

    if (message.method !== "tools/call") {
      return rpcError(message.id, -32601, "MCP method is not enabled by the Corleon browser gateway.");
    }

    const params = message.params;
    const toolName = params?.name;
    if (!isRecord(params) || typeof toolName !== "string" || toolName.length > 128) {
      return rpcError(message.id, -32602, "Invalid tool call parameters.");
    }
    const args = params.arguments ?? {};
    if (!isRecord(args) && !Array.isArray(args)) {
      return rpcError(message.id, -32602, "Tool arguments must be a JSON object or array.");
    }

    const decision = await decisionFor(toolName);
    const digest = actionDigest(toolName, args);
    if (!decision.allowed && !decision.requiresApproval) {
      await writeAudit({
        action: "browser.tool.denied",
        outcome: "denied",
        toolName,
        actionDigest: digest,
        policyReason: decision.reason ?? "Denied by policy.",
      }).catch(() => {});
      return toolError("This browser tool is disabled by Corleon security policy.");
    }

    if (decision.requiresApproval) {
      const token = params._meta?.[APPROVAL_META_KEY];
      let approved = false;
      if (typeof token === "string" && token.length > 0 && token.length <= 2048 && consumeApproval) {
        try {
          approved = (await consumeApproval({
            identity: trustedIdentity,
            toolName,
            actionDigest: digest,
            approvalToken: token,
          })) === true;
        } catch {
          approved = false;
        }
      }
      if (!approved) {
        await writeAudit({
          action: "browser.tool.approval_rejected",
          outcome: "denied",
          toolName,
          actionDigest: digest,
          policyReason: "A valid, unexpired, single-use approval was not supplied.",
        }).catch(() => {});
        return toolError("This browser action requires a valid, single-use Corleon approval.");
      }
    }

    try {
      await writeAudit({
        action: "browser.tool.started",
        outcome: "started",
        toolName,
        actionDigest: digest,
        approvalRequired: decision.requiresApproval,
      });
    } catch {
      return toolError("The browser action was blocked because its audit record could not be persisted.");
    }

    // The approval token is gateway-only metadata and is never forwarded upstream.
    const forwardedParams = { ...params };
    delete forwardedParams._meta;
    try {
      const result = await worker.request({ ...message, params: forwardedParams });
      const validResult = result && responseSize(result) <= maxMessageBytes;
      await writeAudit({
        action: "browser.tool.completed",
        outcome: validResult ? "success" : "error",
        toolName,
        actionDigest: digest,
      });
      return validResult ? result : toolError("Browser worker returned an invalid or oversized response.");
    } catch {
      await writeAudit({
        action: "browser.tool.failed",
        outcome: "error",
        toolName,
        actionDigest: digest,
      }).catch(() => {});
      return toolError("The browser worker could not complete this action.");
    }
  }

  return Object.freeze({
    identity: trustedIdentity,
    handle,
    async close() {
      if (closed) return;
      closed = true;
      await writeAudit({ action: "browser.session.closed", outcome: "success" }).catch(() => {});
      await worker.close();
    },
  });
}
