import { z } from "zod";

export const SourceKindSchema = z.enum([
  "RSS", "SEC_EDGAR", "ISSUER_IR", "USER_UPLOAD", "GITHUB",
  "NOTION_EXPORT", "LICENSED_DATA", "MARKET_DATA",
]);
export const SourceStatusSchema = z.enum(["ACTIVE", "PAUSED", "DISABLED"]);
export const RightsStatusSchema = z.enum(["PENDING", "VERIFIED", "RESTRICTED", "REJECTED"]);
export const ContentModeSchema = z.enum(["METADATA_ONLY", "FULL_TEXT"]);

export const KnowledgeSourceSchema = z.object({
  id: z.string().min(1).max(128),
  tenantId: z.string().min(1).max(128),
  name: z.string().min(1).max(160),
  kind: SourceKindSchema,
  status: SourceStatusSchema,
  rightsStatus: RightsStatusSchema,
  contentMode: ContentModeSchema,
  rightsReference: z.string().max(512).optional(),
  allowedHosts: z.array(z.string().min(1).max(253)).default([]),
  config: z.record(z.string(), z.unknown()).optional(),
});
export type KnowledgeSource = z.infer<typeof KnowledgeSourceSchema>;

export const KnowledgeDocumentInputSchema = z.object({
  tenantId: z.string().min(1).max(128),
  sourceId: z.string().min(1).max(128),
  externalId: z.string().min(1).max(512),
  title: z.string().min(1).max(500),
  canonicalUrl: z.string().url().optional(),
  content: z.string().min(1).max(8_000_000),
  contentMode: ContentModeSchema,
  rightsReference: z.string().max(512).optional(),
  publishedAt: z.coerce.date().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type KnowledgeDocumentInput = z.infer<typeof KnowledgeDocumentInputSchema>;

export interface KnowledgeChunkInput {
  ordinal: number;
  content: string;
  contentHash: string;
}

export interface StoredKnowledgeDocument {
  id: string;
  contentHash: string;
  deduplicated: boolean;
}

export interface KnowledgeRepository {
  getSource(tenantId: string, sourceId: string): Promise<KnowledgeSource | null>;
  upsertDocument(input: KnowledgeDocumentInput & {
    contentHash: string;
    chunks: KnowledgeChunkInput[];
  }): Promise<StoredKnowledgeDocument>;
  writeAudit(input: {
    tenantId: string;
    actorId?: string;
    action: string;
    sourceId: string;
    documentId?: string;
    requestId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void>;
}

export class KnowledgePolicyError extends Error {
  constructor(message: string, readonly code: "SOURCE_NOT_FOUND" | "SOURCE_INACTIVE" | "RIGHTS_UNVERIFIED" | "CONTENT_MODE_DENIED" | "TENANT_MISMATCH") {
    super(message);
    this.name = "KnowledgePolicyError";
  }
}
