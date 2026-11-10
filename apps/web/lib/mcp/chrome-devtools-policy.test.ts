import { describe, expect, it } from "vitest";
import {
  authorizeChromeDevToolsTool,
  createChromeDevToolsMcpServerDefinition,
  getChromeDevToolsPolicyId,
} from "../../../../src/mcp/chrome-devtools.js";

describe("Chrome DevTools MCP integration policy", () => {
  it("allows read-only diagnostics", () => {
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

  it("denies script execution, file uploads and unknown tools", () => {
    expect(authorizeChromeDevToolsTool("evaluate_script").allowed).toBe(false);
    expect(authorizeChromeDevToolsTool("upload_file").allowed).toBe(false);
    expect(authorizeChromeDevToolsTool("unrecognized_tool").allowed).toBe(false);
    expect(getChromeDevToolsPolicyId("unrecognized_tool")).toBe("browser.unknown");
  });

  it("requires approval for every tool in production unless explicitly configured", () => {
    expect(authorizeChromeDevToolsTool("take_snapshot", { production: true })).toMatchObject({
      allowed: false,
      requiresApproval: true,
    });
  });

  it("returns a pinned, isolated stdio server definition", () => {
    const definition = createChromeDevToolsMcpServerDefinition();
    expect(definition.command).toBe("npx");
    expect(definition.transport).toBe("stdio");
    expect(definition.args).toContain("chrome-devtools-mcp@1.12.0");
    expect(definition.args).toContain("--no-javascript-evaluation");
    expect(definition.trust).toBe("local-development-only");
  });

  it("rejects absolute config paths", () => {
    expect(() => createChromeDevToolsMcpServerDefinition({ configPath: "/tmp/unsafe.json" }))
      .toThrow("repository-relative");
  });
});
