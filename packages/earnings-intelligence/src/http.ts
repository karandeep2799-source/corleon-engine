import { DomainError, type TenantAuthorizer, type TranscriptAnalyzer } from "./types.js";
import { ingestAndAnalyzeTranscript, type EarningsRepository } from "./ingestion.js";
import { validateTranscriptInput } from "./transcript.js";

export interface AuthenticatedActor {
  tenantId: string;
  actorId: string;
}

export interface TranscriptHttpDependencies {
  authenticate(request: Request): Promise<AuthenticatedActor | null>;
  authorizer: TenantAuthorizer;
  repository: EarningsRepository;
  analyzer: TranscriptAnalyzer;
  verifySourceRights(input: {
    sourceName: string;
    sourceUrl?: string;
    licenseReference?: string;
    tenantId: string;
    actorId: string;
  }): Promise<boolean>;
  maxBodyBytes?: number;
}

function json(body: unknown, status: number, requestId: string): Response {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-request-id": requestId,
      "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
    },
  });
}

export function createTranscriptPostHandler(deps: TranscriptHttpDependencies) {
  const maxBodyBytes = deps.maxBodyBytes ?? 8 * 1024 * 1024;

  return async function POST(request: Request): Promise<Response> {
    const requestId = request.headers.get("x-request-id")?.slice(0, 128) || crypto.randomUUID();
    try {
      if (request.method !== "POST") {
        return json({ error: { code: "METHOD_NOT_ALLOWED", message: "Use POST." } }, 405, requestId);
      }
      const actor = await deps.authenticate(request);
      if (!actor) {
        return json({ error: { code: "UNAUTHENTICATED", message: "Authentication required." } }, 401, requestId);
      }
      await deps.authorizer.assertCanWrite(actor.tenantId, actor.actorId);

      const declaredLength = Number(request.headers.get("content-length") ?? "0");
      if (Number.isFinite(declaredLength) && declaredLength > maxBodyBytes) {
        throw new DomainError("Request body exceeds the configured size limit.", "VALIDATION", 413);
      }
      const rawBody = await request.text();
      if (new TextEncoder().encode(rawBody).byteLength > maxBodyBytes) {
        throw new DomainError("Request body exceeds the configured size limit.", "VALIDATION", 413);
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(rawBody);
      } catch {
        throw new DomainError("Request body must be valid JSON.", "VALIDATION", 400);
      }

      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new DomainError("Request body must be a JSON object.", "VALIDATION", 400);
      }

      const input = validateTranscriptInput({ ...parsed, tenantId: actor.tenantId });
      const sourceRightsVerified = await deps.verifySourceRights({
        sourceName: input.sourceName,
        ...(input.sourceUrl ? { sourceUrl: input.sourceUrl } : {}),
        ...(input.licenseReference ? { licenseReference: input.licenseReference } : {}),
        tenantId: actor.tenantId,
        actorId: actor.actorId,
      });

      const result = await ingestAndAnalyzeTranscript({
        rawInput: input,
        repository: deps.repository,
        analyzer: deps.analyzer,
        sourceRightsVerified,
      });
      return json({ data: result, requestId }, result.deduplicated ? 200 : 201, requestId);
    } catch (error) {
      if (error instanceof DomainError) {
        return json({ error: { code: error.code, message: error.message }, requestId }, error.status, requestId);
      }
      return json({ error: { code: "INTERNAL", message: "An unexpected error occurred." }, requestId }, 500, requestId);
    }
  };
}
