import test from "node:test";
import assert from "node:assert/strict";
import { normalizeTranscript, splitTranscriptSections, sha256 } from "../dist/transcript.js";

test("normalizes line endings and repeated whitespace", () => {
  assert.equal(normalizeTranscript("  hello\r\n\r\n\r\nworld  "), "hello\n\nworld");
});

test("splits prepared remarks and Q&A while preserving source offsets", () => {
  const source = "Prepared Remarks\nCEO: Revenue grew.\n\nQuestion-and-Answer Session\nAnalyst: Why?";
  const sections = splitTranscriptSections(source);
  assert.equal(sections.length, 2);
  assert.equal(sections[0].sectionType, "PREPARED_REMARKS");
  assert.equal(sections[1].sectionType, "QUESTION_AND_ANSWER");
  assert.equal(source.slice(sections[0].startOffset, sections[0].endOffset).trim(), sections[0].content);
  assert.equal(source.slice(sections[1].startOffset, sections[1].endOffset).trim(), sections[1].content);
});

test("hashes identical content deterministically", () => {
  assert.equal(sha256("transcript"), sha256("transcript"));
  assert.notEqual(sha256("transcript"), sha256("transcript changed"));
});
