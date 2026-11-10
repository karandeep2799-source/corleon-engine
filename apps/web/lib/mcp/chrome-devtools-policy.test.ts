import { describe, expect, it } from "vitest";
import {
  authorizeChromeDevToolsTool,
  createChromeDevToolsMcpServerDefinition,
  getChromeDevToolsPolicyId,
} from "../../../../src/mcp/chrome-devtools.js";

describe("Chrome DevTools MCP integration policy", () => {
  it("allows read-only diagnostics only outside production", () => {
    expect(authorizeChromeDevToolsTool("take_snapshot").allowed).toBe(true);
    expect(authorizeChromeDevToolsTool("list_network_requests").allowed).toBe(true);
    expect(authorizeChromeDevToolsTool("performance_start_trace").allowed).toBe(true);
  });

  it("requires approval for navigation and browser input", () => {
    expect(authorizeChromeDevToolsTool("navigate_page")).toMatchObject({
      allowed: false,
      requiresApproval: true,
    });
    expect(authorizeChromeDevToolsTool("click")).toMatchObject({
      allowed: false,
      requiresApproval: true,
    });
  });

  it("denies script execution, file uploads and unknown tools absolutely", () => {
    for (const name of ["evaluate_script", "upload_file", "unrecognized_tool", "toString", "constructor"]) {
      expect(authorizeChromeDevToolsTool(name)).toMatchObject({
        allowed: false,
        requiresApproval: false,
      });
    }
    expect(getChromeDevToolsPolicyId("unrecognized_tool")).toBe("browser.unknown");
    expect(getChromeDevToolsPolicyId("toString")).toBe("browser.unknown");
  });

  it("requires approval for allowed diagnostics in production", () => {
    expect(authorizeChromeDevToolsTool("take_snapshot", { production: true })).toMatchObject({
      allowed: false,
      requiresApproval: true,
    });
  });

  it("never upgrades an explicitly denied tool to approval-required in production", () => {
    expect(authorizeChromeDevToolsTool("evaluate_script", { production: true })).toMatchObject({
      allowed: false,
      requiresApproval: false,
      reason: "Tool is not enabled by policy.",
    });
    expect(authorizeChromeDevToolsTool("upload_file", { production: true }).allowed).toBe(false);
  });

  it("returns a pinned, isolated stdio server definition", () => {
    const definition = createChromeDevToolsMcpServerDefinition();
    expect(definition.command).toBe("npx");
    expect(definition.transport).toBe("stdio");
    expect(definition.args).toContain("chrome-devtools-mcp@1.12.0");
    expect(definition.args).toContain("--no-javascript-evaluation");
    expect(definition.trust).toBe("local-development-only");
  });

  it("rejects absolute, traversing and malformed config paths", () => {
    for (const configPath of ["/tmp/unsafe.json", "../outside.json", "config/../outside.json", "C:\\unsafe.json", "config//file.json"]) {
      expect(() => createChromeDevToolsMcpServerDefinition({ configPath })).toThrow("repository-relative");
    }
  });
});
