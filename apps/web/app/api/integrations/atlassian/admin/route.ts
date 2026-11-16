import { NextResponse } from "next/server";
import {
  AtlassianAdminError,
  getAtlassianAdminResource,
  isAuthorizedAtlassianRequest,
  type AtlassianResource,
} from "../../../../../lib/atlassian/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-store, max-age=0" };
const resources = new Set<AtlassianResource>([
  "organizations",
  "organization",
  "domains",
  "directories",
  "users",
  "events",
  "events-stream",
  "policies",
]);

export async function GET(request: Request) {
  if (process.env.ATLASSIAN_ADMIN_API_ENABLED !== "true") {
    return NextResponse.json(
      { error: "Atlassian Admin integration is disabled." },
      { status: 503, headers },
    );
  }

  if (!isAuthorizedAtlassianRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers });
  }

  const params = new URL(request.url).searchParams;
  const resource = params.get("resource") as AtlassianResource | null;
  if (!resource || !resources.has(resource)) {
    return NextResponse.json(
      { error: "Unsupported resource. Choose organizations, organization, domains, directories, users, events, events-stream or policies." },
      { status: 400, headers },
    );
  }

  const limitValue = params.get("limit");
  const limit = limitValue === null ? undefined : Number(limitValue);
  if (limitValue !== null && (!Number.isInteger(limit) || limit! < 1 || limit! > 500)) {
    return NextResponse.json({ error: "Limit must be an integer between 1 and 500." }, { status: 400, headers });
  }

  try {
    const data = await getAtlassianAdminResource(resource, {
      orgId: params.get("orgId") ?? process.env.ATLASSIAN_ORG_ID,
      directoryId: params.get("directoryId") ?? undefined,
      cursor: params.get("cursor") ?? undefined,
      limit,
      searchTerm: params.get("searchTerm") ?? undefined,
    });
    return NextResponse.json({ resource, data }, { headers });
  } catch (error) {
    if (error instanceof AtlassianAdminError) {
      return NextResponse.json(
        { error: error.message },
        {
          status: error.status,
          headers: {
            ...headers,
            ...(error.retryAfter ? { "Retry-After": error.retryAfter } : {}),
          },
        },
      );
    }
    return NextResponse.json(
      { error: "Unable to retrieve Atlassian organization data." },
      { status: 500, headers },
    );
  }
}
