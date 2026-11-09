import { z } from "zod";

export const MAX_SOURCE_BYTES = 12_000;
export const MAX_OUTPUT_BYTES = 16_000;
export const SANDBOX_TIMEOUT_MS = 15_000;

export const sandboxJobInputSchema = z.object({
  runtime: z.enum(["node", "python"]).default("node"),
  code: z
    .string()
    .min(1, "Code is required")
    .max(MAX_SOURCE_BYTES, "Code exceeds the 12 KB limit")
    .refine((value) => Buffer.byteLength(value, "utf8") <= MAX_SOURCE_BYTES, {
      message: "Code exceeds the 12 KB UTF-8 limit",
    }),
}).strict();

export type SandboxJobInput = z.infer<typeof sandboxJobInputSchema>;

export function isValidIdempotencyKey(value: string | null): value is string {
  return value !== null && /^[A-Za-z0-9._:-]{8,128}$/.test(value);
}
