# Vercel Passport integration

This repository currently contains JavaScript API modules and Prisma/PostgreSQL,
but does not currently have a Next.js application directory or an application
authentication/session layer. The helpers in `src/security/vercel-passport.js`
are therefore framework-neutral building blocks; this change does not pretend
to wire Passport into a Next.js route that does not exist yet.

## What is included

- `@vercel/passport` dependency (minimum documented version 0.1.3).
- Fail-closed identity normalization and resolution.
- Exact external-subject allowlisting for privileged internal operations.
- Node's built-in test coverage for missing, malformed, and unauthorized identities.

## Vercel prerequisites

1. Confirm Passport entitlement and enable Passport for the intended Vercel
   project/team. Passport is an Enterprise feature; this team's connected
   Vercel context reported the Hobby plan at the time this integration was prepared.
2. Configure an identity provider and the Passport deployment protection policy.
3. Keep the public customer application separate unless it has an explicit
   product requirement for Passport.
4. Deploy the protected internal application and verify an unauthenticated
   request is blocked at the Vercel edge before application code runs.

## Server-side usage

Only call Passport from server-side code running in a Passport-protected Vercel
deployment. Never accept an identity object or Passport token from request JSON,
query parameters, or client-controlled headers.

```js
import {
  getPassportPrincipal,
  passportAuthorization,
} from "../../src/security/vercel-passport.js";

export async function GET() {
  const principal = await getPassportPrincipal();
  const result = passportAuthorization(principal);

  if (result.status !== 200) {
    return Response.json({ error: result.body.error }, { status: result.status });
  }

  // Return only fields that this endpoint is allowed to disclose.
  return Response.json({
    subject: principal.subject,
    name: principal.name,
  });
}
```

The snippet is an example for a future Next.js App Router route handler, not a
route currently installed in this repository. Once a Next.js app is present,
put it in that app's `app/api/internal/me/route.js` and adjust the relative
import path to match the app layout.

## Admin allowlist

Set `CORLEON_PASSPORT_ADMIN_SUBJECTS` on the server to a comma-separated list
of exact identity-provider subject identifiers. Do not use email addresses as
the authorization key. An empty or missing allowlist denies all privileged
requests.

```js
import {
  getPassportPrincipal,
  passportAuthorization,
} from "../../src/security/vercel-passport.js";

export async function POST() {
  const principal = await getPassportPrincipal();
  const result = passportAuthorization(principal, {
    admin: true,
    adminSubjects: process.env.CORLEON_PASSPORT_ADMIN_SUBJECTS,
  });

  if (result.status !== 200) {
    return Response.json({ error: result.body.error }, { status: result.status });
  }

  // Continue with the narrowly scoped administrative operation.
  return Response.json({ ok: true });
}
```

## Persistence and tenant authorization

Do not infer tenant membership or application roles from Passport authentication.
Before production use with Corleon data, add a reviewed database migration for a
stable external identity mapping (issuer + external subject), link it to the
existing internal `User` model, and authorize each requested organization/resource
against existing membership records. Never auto-grant OWNER or ADMIN based on
an email domain or a successful Passport login.

If accepting identities from more than one Passport issuer/team, include the
issuer in the unique identity key. Avoid logging raw tokens or full identity
payloads. Forward Passport tokens only over HTTPS to backend services you operate
and verify them in the receiving service as documented by Vercel.

## Verification

Run:

```sh
npm install
npm test
```

Before production rollout, also verify:
- no Passport identity => 401 at the application boundary;
- authenticated but not allowlisted admin => 403;
- exact allowlisted external subject => authorized only for the intended operation;
- organization/resource authorization still runs for every data access;
- preview and production deployments have the intended protection policy;
- no secrets or raw Passport tokens appear in responses or logs.
