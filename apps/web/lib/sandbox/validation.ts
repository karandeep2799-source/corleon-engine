import { z } from "zod";

export const MAX_SOURCE_BYTES = 12 * 1024;
export const MAX_OUTPUT_BYTES = 16 * 1024;
export const MAX_TIMEOUT_MS = 30_000;
export const DEFAULT_TIMEOUT_MS = 15_000;
export const MAX_REQUEST_BYTES = 16 * 1024;

export const sandboxJobInputSchema = z.object({
  runtime: z.enum(["node", "python"]),
  code: z.string().min(1).max(MAX_SOURCE_BYTES),
  timeoutMs: z.number().int().min(1_000).max(MAX_TIMEOUT_MS).default(DEFAULT_TIMEOUT_MS),
}).strict();

export type SandboxJobInput = z.infer<typeof sandboxJobInputSchema>;

export function isValidIdempotencyKey(value: string): boolean {
  return value.length >= 8 &&
    value.length <= 128 &&
    /^[a-zA-Z0-9._:-]+$/.test(value);
}
