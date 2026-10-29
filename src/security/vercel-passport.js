/**
 * Vercel Passport identity helpers.
 *
 * Call only from server-side code running in a Passport-protected Vercel
 * deployment. Never trust identity headers supplied directly by a client.
 */
export function normalizePassportIdentity(identity) {
  if (!identity || typeof identity !== "object") return null;

  const subject =
    typeof identity.subject === "string" ? identity.subject.trim() : "";
  const externalSubject =
    typeof identity.externalSubject === "string"
      ? identity.externalSubject.trim()
      : "";
  const issuer =
    typeof identity.payload?.iss === "string"
      ? identity.payload.iss.trim()
      : "";

  // Subject is the stable Passport identity. Email and display name are
  // optional profile attributes and must never be used as authorization keys.
  if (!subject || !externalSubject || !issuer) return null;

  return Object.freeze({
    subject,
    externalSubject,
    issuer,
    email: typeof identity.email === "string" ? identity.email : null,
    name: typeof identity.name === "string" ? identity.name : null,
  });
}

/**
 * Resolves a verified Passport identity. Fails closed when Passport is
 * unavailable, the request is not protected, or verification throws.
 */
export async function getPassportPrincipal(getIdentity) {
  try {
    const resolveIdentity =
      getIdentity ??
      (async () => {
        const passport = await import("@vercel/passport");
        return passport.getIdentity();
      });

    return normalizePassportIdentity(await resolveIdentity());
  } catch {
    return null;
  }
}

/**
 * Restrict privileged internal operations to an explicit allowlist of
 * Passport external subjects. Configure CORLEON_PASSPORT_ADMIN_SUBJECTS as
 * a comma-separated list of exact external subject identifiers.
 *
 * Do not put email addresses here. Empty configuration denies everyone.
 */
export function isPassportAdmin(principal, configuredSubjects) {
  if (!principal?.externalSubject || !configuredSubjects) return false;

  const allowed = new Set(
    configuredSubjects
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );

  return allowed.has(principal.externalSubject);
}

/**
 * Small framework-neutral response helper for API handlers.
 * Use the returned status/body to adapt to your framework's response API.
 */
export function passportAuthorization(principal, { admin = false, adminSubjects } = {}) {
  if (!principal) {
    return { status: 401, body: { error: "unauthorized" } };
  }

  if (admin && !isPassportAdmin(principal, adminSubjects)) {
    return { status: 403, body: { error: "forbidden" } };
  }

  return { status: 200, body: { principal } };
}
