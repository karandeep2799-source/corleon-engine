import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AtlassianAdminError,
  buildAtlassianAdminPath,
  getAtlassianAdminResource,
  isAuthorizedAtlassianRequest,
} from "./admin";

describe("Atlassian Admin API client", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("builds the organization list path without an organization ID", () => {
    expect(buildAtlassianAdminPath("organizations")).toBe("/v1/orgs");
  });

  it("requires an organization ID for organization-scoped resources", () => {
    expect(() => buildAtlassianAdminPath("domains")).toThrowError(
      "An organization ID is required.",
    );
  });

  it("encodes path segments and rejects path traversal characters", () => {
    expect(buildAtlassianAdminPath("domains", { orgId: "org id" })).toBe(
      "/v1/orgs/org%20id/domains",
    );
    expect(() => buildAtlassianAdminPath("domains", { orgId: "../other" })).toThrow();
  });

  it("uses the directory user-search endpoint for scoped user search", () => {
    expect(
      buildAtlassianAdminPath("users", { orgId: "org", directoryId: "directory" }),
    ).toBe("/v2/orgs/org/directories/directory/users/search");
  });

  it("rejects an invalid page limit", async () => {
    vi.stubEnv("ATLASSIAN_ADMIN_API_KEY", "test-key");
    await expect(
      getAtlassianAdminResource("domains", { orgId: "org", limit: 501 }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("fails closed when the integration key is missing", async () => {
    vi.stubEnv("ATLASSIAN_ADMIN_API_KEY", "");
    await expect(getAtlassianAdminResource("organizations")).rejects.toBeInstanceOf(
      AtlassianAdminError,
    );
  });

  it("authenticates internal requests with a separate bearer token", () => {
    vi.stubEnv("CORLEON_ATLASSIAN_ROUTE_TOKEN", "route-secret");
    expect(
      isAuthorizedAtlassianRequest(
        new Request("https://example.test", {
          headers: { Authorization: "Bearer route-secret" },
        }),
      ),
    ).toBe(true);
    expect(
      isAuthorizedAtlassianRequest(
        new Request("https://example.test", {
          headers: { Authorization: "Bearer wrong-secret" },
        }),
      ),
    ).toBe(false);
  });
});
