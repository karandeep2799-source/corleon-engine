import test from "node:test";
import assert from "node:assert/strict";
import { chunkKnowledgeText, normalizeKnowledgeText, sha256 } from "../dist/normalize.js";

test("normalizes unicode, line endings and whitespace", () => {
  assert.equal(normalizeKnowledgeText(" hello\r\n\r\nworld  "), "hello\n\nworld");
});

test("creates deterministic hashes", () => {
  assert.equal(sha256("knowledge"), sha256("knowledge"));
  assert.notEqual(sha256("knowledge"), sha256("different"));
});

test("chunks long text with stable ordinals and overlap", () => {
  const content = "paragraph ".repeat(500);
  const chunks = chunkKnowledgeText(content, { maxChars: 500, overlapChars: 50 });
  assert.ok(chunks.length > 1);
  assert.equal(chunks[0].ordinal, 0);
  assert.equal(chunks[1].ordinal, 1);
  assert.ok(chunks.every((chunk) => chunk.contentHash === sha256(chunk.content)));
});
