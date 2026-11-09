import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getDeploymentMetadata } from "./deployment";

describe("getDeploymentMetadata", () => {
  it("returns safe local defaults outside Vercel", () => {
    expect(getDeploymentMetadata({})).toEqual({
      provider: "local",
      environment: "development",
      isVercelDeployment: false,
      deploymentId: null,
      deploymentUrl: null,
      productionUrl: null,
      region: null,
      git: {
        branch: null,
        commitSha: null,
        pullRequestId: null,
      },
      skewProtectionEnabled: null,
    });
  });

  it("normalizes documented Vercel metadata", () => {
    expect(
      getDeploymentMetadata({
        VERCEL: "1",
        VERCEL_ENV: "preview",
        VERCEL_DEPLOYMENT_ID: "dpl_example",
        VERCEL_URL: "preview.example.vercel.app",
        VERCEL_PROJECT_PRODUCTION_URL: "corleon-engine.vercel.app",
        VERCEL_REGION: "bom1",
        VERCEL_GIT_COMMIT_REF: "feat/example",
        VERCEL_GIT_COMMIT_SHA: "abc123",
        VERCEL_GIT_PULL_REQUEST_ID: "42",
        VERCEL_SKEW_PROTECTION_ENABLED: "1",
      }),
    ).toEqual({
      provider: "vercel",
      environment: "preview",
      isVercelDeployment: true,
      deploymentId: "dpl_example",
      deploymentUrl: "https://preview.example.vercel.app",
      productionUrl: "https://corleon-engine.vercel.app",
      region: "bom1",
      git: {
        branch: "feat/example",
        commitSha: "abc123",
        pullRequestId: "42",
      },
      skewProtectionEnabled: true,
    });
  });

  it("rejects malformed deployment URLs and unknown environment labels", () => {
    const metadata = getDeploymentMetadata({
      VERCEL: "1",
      VERCEL_ENV: "staging",
      VERCEL_URL: "javascript:alert(1)",
      VERCEL_PROJECT_PRODUCTION_URL: "not a valid host",
      VERCEL_SKEW_PROTECTION_ENABLED: "maybe",
    });

    expect(metadata.environment).toBe("unknown");
    expect(metadata.deploymentUrl).toBeNull();
    expect(metadata.productionUrl).toBeNull();
    expect(metadata.skewProtectionEnabled).toBeNull();
  });

  it("does not expose OIDC tokens or arbitrary environment values", () => {
    const metadata = getDeploymentMetadata({
      VERCEL: "1",
      VERCEL_ENV: "production",
      VERCEL_OIDC_TOKEN: "must-never-be-returned",
      DATABASE_URL: "postgres://secret",
    });

    expect(JSON.stringify(metadata)).not.toContain("must-never-be-returned");
    expect(JSON.stringify(metadata)).not.toContain("postgres://secret");
  });
});
