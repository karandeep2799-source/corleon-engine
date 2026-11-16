import test from "node:test";
import assert from "node:assert/strict";
import { detectGooglePageLicenses, formatGoogleAttribution, isReleaseBlocked, validateManifest, validateSourceRecord } from "../dist/index.js";

const source = {
  id: "google-mlkit-guides", title: "Google ML Kit Guides",
  sourceUrl: "https://developers.google.com/ml-kit/guides", publisher: "Google",
  materialKind: "documentation", license: "CC-BY-4.0",
  licenseEvidence: "Footer identifies CC BY 4.0", reviewed: true,
  attributionRequired: true, reviewedOn: "2026-11-16"
};

test("accepts reviewed CC BY documentation", () => assert.deepEqual(validateSourceRecord(source), []));
test("rejects HTTP sources and disabled attribution", () => {
  const issues = validateSourceRecord({ ...source, sourceUrl: "http://example.com", attributionRequired: false });
  assert.ok(issues.some((x) => x.path === "sourceUrl"));
  assert.ok(issues.some((x) => x.path === "attributionRequired"));
});
test("does not classify Google brand features as CC BY", () => {
  assert.ok(validateSourceRecord({ ...source, materialKind: "brand-feature" }).some((x) => x.path === "license"));
});
test("detects explicit documentation and code notices separately", () => {
  const result = detectGooglePageLicenses("Creative Commons Attribution 4.0 License; code samples are licensed under the Apache 2.0 License");
  assert.equal(result.documentation, "CC-BY-4.0");
  assert.equal(result.codeSamples, "Apache-2.0");
});
test("blocks unknown and unreviewed material", () => {
  assert.equal(isReleaseBlocked({ version: 1, sources: [source] }), false);
  assert.equal(isReleaseBlocked({ version: 1, sources: [{ ...source, reviewed: false }] }), true);
  assert.equal(isReleaseBlocked({ version: 1, sources: [{ ...source, license: "unknown" }] }), true);
});
test("rejects duplicate manifest ids", () => {
  assert.ok(validateManifest({ version: 1, sources: [source, source] }).some((x) => x.message === "Duplicate source id."));
});
test("formats Google attribution with policy, license and source links", () => {
  const output = formatGoogleAttribution(source.sourceUrl, "modified");
  assert.match(output, /modifications based on work/);
  assert.match(output, /developers.google.com\\/readme\\/policies/);
  assert.match(output, /creativecommons.org\\/licenses\\/by\\/4\\.0/);
  assert.match(output, /developers.google.com\\/ml-kit\\/guides/);
});
