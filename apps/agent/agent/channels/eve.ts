import { type AuthFn, localDev, vercelOidc } from "eve/channels/auth";
import { eveChannel } from "eve/channels/eve";

const localDevAuth = localDev();

/**
 * Local development fallback only. The fallback first delegates to eve's
 * localDev authenticator, then upgrades an accepted local principal to a user
 * principal so user-scoped Vercel Connect grants can be exercised locally.
 */
const localDevUser: AuthFn<Request> = async (request) => {
  const local = await localDevAuth(request);
  return local ? { ...local, principalType: "user" } : null;
};

export default eveChannel({
  auth: [vercelOidc(), localDevUser],
});
