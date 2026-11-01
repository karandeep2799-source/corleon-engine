import test from "node:test";
import assert from "node:assert/strict";
import { assertSourceCanIngest } from "../dist/policy.js";

const source = {
  id: "src-1",
  tenantId: "tenant-1",
  name: "Internal docs",
  kind: "USER_UPLOAD",
  status: "ACTIVE",
  rightsStatus: "VERIFIED",
  contentMode: "FULL_TEXT",
  rightsReference: "user-upload-confirmation-1",
  allowedHosts: [],
};

const document = {
  tenantId: "tenant-1",
  sourceId: "src-1",
  externalId: "doc-1",
  title: "Test document",
  content: "A sufficiently long test document.",
  contentMode: "FULL_TEXT",
  rightsReference: "user-upload-confirmation-1",
};

test("accepts a tenant-scoped source with verified full-text rights", () => {
  assert.doesNotThrow(() => assertSourceCanIngest(source, document));
});

test("rejects an unverified source", () => {
  assert.throws(
    () => assertSourceCanIngest({ ...source, rightsStatus: "PENDING" }, document),
    { code: "RIGHTS_UNVERIFIED" },
  );
});

test("rejects a cross-tenant document", () => {
  assert.throws(
    () => assertSourceCanIngest(source, { ...document, tenantId: "tenant-2" }),
    { code: "TENANT_MISMATCH" },
  );
});

test("rejects full-text mode without a rights reference", () => {
  assert.throws(
    () => assertSourceCanIngest({ ...source, rightsReference: undefined }, { ...document, rightsReference: undefined }),
    { code: "CONTENT_MODE_DENIED" },
  );
});
