import { type AuthFn, localDev, vercelOidc, vercelSubject } from "eve/channels/auth";
import { eveChannel } from "eve/channels/eve";

/**
 * The HTTP channel is private to the Corleon Engine Vercel project.
 * Browser access is not enabled until Corleon's application authentication
 * is connected to an explicit user-session AuthFn.
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

/**
 * Local-only adapter for user-scoped Vercel Connect grants.
 * localDev() first decides whether the request is trusted local development;
 * this never upgrades a production request.
 */
const localDevUser: AuthFn<Request> = async (request) => {
  const local = await localDevAuth(request);
  return local ? { ...local, principalType: "user" } : null;
};

export default eveChannel({ auth: [deploymentAuth, localDevUser] });
