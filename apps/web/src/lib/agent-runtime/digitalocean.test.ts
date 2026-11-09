import { afterEach, describe, expect, it } from "vitest";
import { buildEnvironmentSpec } from "./digitalocean";

describe("DigitalOcean Harness Runtime environment spec", () => {
  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
  });

  it("creates a default-deny-by-omission, approval-first Codex environment", () => {
    process.env.OPENAI_API_KEY = "test-openai-key";
    const spec = buildEnvironmentSpec({ name: "corleon-test", adapter: "CODEX", prompt: "test task" });
    expect(spec).toContain("harness: codex");
    expect(spec).toContain("default: ask");
    expect(spec).toContain("action: ask");
    expect(spec).toContain("mode: workspace-write");
    expect(spec).toContain("  - api.github.com");
    expect(spec).not.toContain("egress: unrestricted");
  });

  it("rejects a repository that is not OWNER/REPO", () => {
    process.env.OPENAI_API_KEY = "test-openai-key";
    expect(() => buildEnvironmentSpec({ name: "corleon-test", adapter: "CODEX", prompt: "test", repository: "https://github.com/example/repo" })).toThrow("OWNER/REPO");
  });

  it("requires a provider credential before provisioning", () => {
    expect(() => buildEnvironmentSpec({ name: "corleon-test", adapter: "CLAUDE_CODE", prompt: "test" })).toThrow("ANTHROPIC_API_KEY");
  });
});
