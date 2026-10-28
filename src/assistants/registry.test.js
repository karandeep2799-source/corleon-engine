import test from "node:test";
import assert from "node:assert/strict";
import { ASSISTANT_REGISTRY, getAssistantDefinition } from "./registry.js";

test("registry has 35 unique independent assistants with valid metadata", () => {
  assert.equal(ASSISTANT_REGISTRY.length, 35);
  assert.equal(new Set(ASSISTANT_REGISTRY.map((x) => x.id)).size, 35);
  for (const item of ASSISTANT_REGISTRY) {
    assert.ok(item.name && item.category && item.instructions);
    assert.ok(["ready", "integration-required"].includes(item.readiness));
    assert.ok(["text", "document", "image", "tool"].includes(item.outputMode));
  }
});
test("lookup handles known and unknown IDs", () => {
  assert.equal(getAssistantDefinition("proofreading")?.name, "Proofreading");
  assert.equal(getAssistantDefinition("missing"), null);
});
test("non-wired capabilities are explicitly gated", () => {
  assert.equal(getAssistantDefinition("image-generator").readiness, "integration-required");
  assert.equal(getAssistantDefinition("mcp-tool-agent").readiness, "integration-required");
});
