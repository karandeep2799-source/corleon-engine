import { type AuthFn, localDev, vercelOidc, vercelSubject } from "eve/channels/auth";
import { eveChannel } from "eve/channels/eve";

/**
 * Private service-to-service HTTP channel. The browser cannot call this route
 * until the platform's application authentication is explicitly integrated.
 */
const teamSlug = process.env.VERCEL_TEAM_SLUG ?? "karandeep2799-sources-projects";
const projectName = process.env.VERCEL_PROJECT_NAME ?? "corleon-engine";

const deploymentAuth = vercelOidc({
  subjects: [
    vercelSubject({ teamSlug, projectName, environment: "preview" }),
    vercelSubject({ teamSlug, projectName, environment: "production" }),
  ],
});

const localDevAuth = localDev();

/** Only trusted local development requests are upgraded for user-scoped Connect grants. */
const localDevUser: AuthFn<Request> = async (request) => {
  const local = await localDevAuth(request);
  return local ? { ...local, principalType: "user" } : null;
};

export default eveChannel({ auth: [deploymentAuth, localDevUser] });
