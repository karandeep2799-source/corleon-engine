import test from "node:test";
import assert from "node:assert/strict";
import {
  getPassportPrincipal,
  isPassportAdmin,
  normalizePassportIdentity,
  passportAuthorization,
} from "./vercel-passport.js";

const identity = {
  subject: "passport-subject-123",
  externalSubject: "idp-user-456",
  email: "admin@example.test",
  name: "Example Admin",
  payload: { iss: "https://passport.example.test" },
};

test("normalizes verified identity without using email as a key", () => {
  const principal = normalizePassportIdentity(identity);
  assert.equal(principal.subject, "passport-subject-123");
  assert.equal(principal.externalSubject, "idp-user-456");
  assert.equal(principal.issuer, "https://passport.example.test");
  assert.equal(principal.email, "admin@example.test");
});

test("rejects missing or incomplete identity", () => {
  assert.equal(normalizePassportIdentity(null), null);
  assert.equal(normalizePassportIdentity({ ...identity, subject: " " }), null);
  assert.equal(normalizePassportIdentity({ ...identity, payload: {} }), null);
});

test("identity resolution fails closed when absent or throwing", async () => {
  assert.equal(await getPassportPrincipal(async () => null), null);
  assert.equal(
    await getPassportPrincipal(async () => {
      throw new Error("verification failed");
    }),
    null,
  );
});

test("admin authorization requires exact external-subject allowlist", () => {
  const principal = normalizePassportIdentity(identity);
  assert.equal(isPassportAdmin(principal, "someone-else,idp-user-456"), true);
  assert.equal(isPassportAdmin(principal, "admin@example.test"), false);
  assert.equal(isPassportAdmin(principal, ""), false);
  assert.equal(isPassportAdmin(null, "idp-user-456"), false);
});

test("authorization helper returns 401 and 403 before success", () => {
  assert.equal(passportAuthorization(null).status, 401);

  const principal = normalizePassportIdentity(identity);
  assert.equal(
    passportAuthorization(principal, {
      admin: true,
      adminSubjects: "other-subject",
    }).status,
    403,
  );

  assert.equal(
    passportAuthorization(principal, {
      admin: true,
      adminSubjects: "idp-user-456",
    }).status,
    200,
  );
});
