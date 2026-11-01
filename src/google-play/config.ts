export interface GooglePlayServiceAccount { client_email: string; private_key: string; token_uri?: string; }
const PACKAGE_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/;
export function getGooglePlayConfig() {
  const rawPackageName = process.env.GOOGLE_PLAY_PACKAGE_NAME?.trim();
  const packageName = rawPackageName && PACKAGE_NAME_PATTERN.test(rawPackageName) ? rawPackageName : undefined;
  const rawAccount = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
  let serviceAccount: GooglePlayServiceAccount | undefined;
  let credentialError: string | undefined;
  if (rawAccount) {
    try {
      const parsed = JSON.parse(rawAccount) as Partial<GooglePlayServiceAccount>;
      if (typeof parsed.client_email !== 'string' || typeof parsed.private_key !== 'string') throw new Error('Missing service-account fields');
      serviceAccount = { client_email: parsed.client_email, private_key: parsed.private_key.replace(/\\n/g, '\n'), token_uri: parsed.token_uri };
    } catch { credentialError = 'GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is not valid service-account JSON'; }
  }
  return {
    packageName, packageNameConfigured: Boolean(packageName), packageNameError: rawPackageName && !packageName ? 'GOOGLE_PLAY_PACKAGE_NAME is not a valid Android application ID' : undefined,
    serviceAccount, credentialError, adminTokenConfigured: Boolean(process.env.GOOGLE_PLAY_ADMIN_TOKEN),
    developerAccountIdConfigured: Boolean(process.env.GOOGLE_PLAY_DEVELOPER_ACCOUNT_ID),
    pubSubConfigured: Boolean(process.env.GOOGLE_PLAY_PUBSUB_AUDIENCE && process.env.GOOGLE_PLAY_PUBSUB_SERVICE_ACCOUNT_EMAIL),
    publishingEnabled: process.env.GOOGLE_PLAY_PUBLISHING_ENABLED === 'true',
    supportWritesEnabled: process.env.GOOGLE_PLAY_SUPPORT_WRITES_ENABLED === 'true',
    writeApprovalConfigured: Boolean(process.env.GOOGLE_PLAY_WRITE_APPROVAL_TOKEN),
  };
}