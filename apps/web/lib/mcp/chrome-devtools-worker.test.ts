import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workerConfig = JSON.parse(
  readFileSync(new URL("../../../../config/mcp/chrome-devtools-worker.json", import.meta.url), "utf8"),
) as Record<string, unknown>;

describe("Chrome DevTools production worker profile", () => {
  it("routes browser traffic through the isolated egress proxy", () => {
    expect(workerConfig.proxyServer).toBe("http://egress-proxy:3128");
    expect(workerConfig.executablePath).toBe("/usr/bin/chromium");
    expect(workerConfig.isolated).toBe(true);
    expect(workerConfig.pageIdRouting).toBe(true);
  });

  it("keeps high-risk tool categories disabled", () => {
    expect(workerConfig.categoryInput).toBe(false);
    expect(workerConfig.categoryExtensions).toBe(false);
    expect(workerConfig.categoryExperimentalThirdParty).toBe(false);
    expect(workerConfig.categoryExperimentalWebmcp).toBe(false);
    expect(workerConfig.categoryPwa).toBe(false);
    expect(workerConfig.categoryWebauthn).toBe(false);
    expect(workerConfig.experimentalDevtools).toBe(false);
    expect(workerConfig.experimentalVision).toBe(false);
    expect(workerConfig.acceptInsecureCerts).toBe(false);
    expect(workerConfig.redactNetworkHeaders).toBe(true);
  });

  it("blocks common local and cloud metadata URL targets", () => {
    const blocked = workerConfig.blockedUrlPattern as string[];
    expect(blocked).toContain("http://169.254.169.254/*");
    expect(blocked).toContain("http://localhost/*");
    expect(blocked).toContain("https://127.0.0.1/*");
  });
});
