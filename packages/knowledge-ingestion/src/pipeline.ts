import { KnowledgeDocumentInputSchema, KnowledgePolicyError, type KnowledgeDocumentInput, type KnowledgeRepository } from "./types.js";
import { assertSourceCanIngest } from "./policy.js";
import { chunkKnowledgeText, normalizeKnowledgeText, sha256 } from "./normalize.js";

export async function ingestKnowledgeDocument(
  repository: KnowledgeRepository,
  rawInput: unknown,
  actor: { tenantId: string; actorId?: string; requestId?: string },
): Promise<{ documentId: string; contentHash: string; deduplicated: boolean; chunkCount: number }> {
  const parsed = KnowledgeDocumentInputSchema.safeParse(rawInput);
  if (!parsed.success) throw new TypeError(parsed.error.issues.map((issue) => issue.message).join("; "));
  const input: KnowledgeDocumentInput = {
    ...parsed.data,
    tenantId: actor.tenantId,
    content: normalizeKnowledgeText(parsed.data.content),
  };
  if (input.tenantId !== parsed.data.tenantId) {
    throw new KnowledgePolicyError("Authenticated tenant does not match the document tenant.", "TENANT_MISMATCH");
  }
  if (!input.content) throw new TypeError("Document content is empty after normalization.");

  const source = await repository.getSource(actor.tenantId, input.sourceId);
  if (!source) throw new KnowledgePolicyError("Knowledge source was not found in this tenant.", "SOURCE_NOT_FOUND");
  assertSourceCanIngest(source, input);

  const contentHash = sha256(input.content);
  const chunks = input.contentMode === "METADATA_ONLY"
    ? [{ ordinal: 0, content: input.content.slice(0, 12_000), contentHash: sha256(input.content.slice(0, 12_000)) }]
    : chunkKnowledgeText(input.content);

  const stored = await repository.upsertDocument({ ...input, contentHash, chunks });
  await repository.writeAudit({
    tenantId: actor.tenantId,
    ...(actor.actorId ? { actorId: actor.actorId } : {}),
    action: stored.deduplicated ? "KNOWLEDGE_DOCUMENT_DEDUPLICATED" : "KNOWLEDGE_DOCUMENT_INGESTED",
    sourceId: source.id,
    documentId: stored.id,
    ...(actor.requestId ? { requestId: actor.requestId } : {}),
    metadata: { contentMode: input.contentMode, contentHash, chunkCount: chunks.length },
  });
  return { documentId: stored.id, contentHash, deduplicated: stored.deduplicated, chunkCount: chunks.length };
}
