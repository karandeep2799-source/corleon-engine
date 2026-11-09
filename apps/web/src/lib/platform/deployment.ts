import "server-only";

export type DeploymentEnvironment =
  | "production"
  | "preview"
  | "development"
  | "unknown";

export interface DeploymentMetadata {
  provider: "vercel" | "local";
  environment: DeploymentEnvironment;
  isVercelDeployment: boolean;
  deploymentId: string | null;
  deploymentUrl: string | null;
  productionUrl: string | null;
  region: string | null;
  git: {
    branch: string | null;
    commitSha: string | null;
    pullRequestId: string | null;
  };
  skewProtectionEnabled: boolean | null;
}

type Environment = Record<string, string | undefined>;

function normalizeHttpsUrl(hostname: string | undefined): string | null {
  if (!hostname) return null;

  const candidate = hostname.startsWith("https://")
    ? hostname
    : `https://${hostname}`;

  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

function parseBoolean(value: string | undefined): boolean | null {
  if (value === undefined || value === "") return null;
  if (value === "1" || value.toLowerCase() === "true") return true;
  if (value === "0" || value.toLowerCase() === "false") return false;
  return null;
}

/**
 * Convert Vercel's documented system environment variables into safe,
 * structured deployment metadata. Never include environment variable values
 * wholesale: this intentionally excludes secrets and VERCEL_OIDC_TOKEN.
 */
export function getDeploymentMetadata(
  env: Environment = process.env,
): DeploymentMetadata {
  const vercelEnvironment = env.VERCEL_ENV;
  const environment: DeploymentEnvironment =
    vercelEnvironment === "production" ||
    vercelEnvironment === "preview" ||
    vercelEnvironment === "development"
      ? vercelEnvironment
      : "unknown";

  const isVercelDeployment = env.VERCEL === "1";

  return {
    provider: isVercelDeployment ? "vercel" : "local",
    environment: isVercelDeployment ? environment : "development",
    isVercelDeployment,
    deploymentId: env.VERCEL_DEPLOYMENT_ID ?? null,
    deploymentUrl: normalizeHttpsUrl(env.VERCEL_URL),
    productionUrl: normalizeHttpsUrl(env.VERCEL_PROJECT_PRODUCTION_URL),
    region: env.VERCEL_REGION ?? null,
    git: {
      branch: env.VERCEL_GIT_COMMIT_REF ?? null,
      commitSha: env.VERCEL_GIT_COMMIT_SHA ?? null,
      pullRequestId: env.VERCEL_GIT_PULL_REQUEST_ID ?? null,
    },
    skewProtectionEnabled: parseBoolean(
      env.VERCEL_SKEW_PROTECTION_ENABLED,
    ),
  };
}
