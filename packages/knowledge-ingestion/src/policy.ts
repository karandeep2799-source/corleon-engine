import type { KnowledgeDocumentInput, KnowledgeSource } from "./types.js";
import { KnowledgePolicyError } from "./types.js";

export function assertSourceCanIngest(
  source: KnowledgeSource,
  input: KnowledgeDocumentInput,
): void {
  if (source.tenantId !== input.tenantId || source.id !== input.sourceId) {
    throw new KnowledgePolicyError("Source and document tenant scope do not match.", "TENANT_MISMATCH");
  }
  if (source.status !== "ACTIVE") {
    throw new KnowledgePolicyError("Knowledge source is not active.", "SOURCE_INACTIVE");
  }
  if (source.rightsStatus !== "VERIFIED") {
    throw new KnowledgePolicyError("Source rights must be verified before ingestion.", "RIGHTS_UNVERIFIED");
  }
  if (input.contentMode !== source.contentMode) {
    throw new KnowledgePolicyError("Document content mode does not match the approved source mode.", "CONTENT_MODE_DENIED");
  }
  if (input.contentMode === "FULL_TEXT" && !source.rightsReference?.trim()) {
    throw new KnowledgePolicyError("Full-text ingestion requires a recorded license or rights reference.", "CONTENT_MODE_DENIED");
  }
  if (input.contentMode === "METADATA_ONLY" && input.content.length > 12_000) {
    throw new KnowledgePolicyError("Metadata-only documents exceed the configured safe size limit.", "CONTENT_MODE_DENIED");
  }
  if (input.rightsReference && source.rightsReference && input.rightsReference !== source.rightsReference) {
    throw new KnowledgePolicyError("Document rights reference does not match the approved source rights record.", "CONTENT_MODE_DENIED");
  }
}
