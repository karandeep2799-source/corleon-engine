import { describe, expect, it } from "vitest";
import {
  MAX_SOURCE_BYTES,
  sandboxJobInputSchema,
  isValidIdempotencyKey,
} from "./validation";

describe("sandbox job validation", () => {
  it("accepts supported runtimes and applies the default timeout", () => {
    expect(sandboxJobInputSchema.parse({ runtime: "node", code: "console.log(1)" }))
      .toEqual({ runtime: "node", code: "console.log(1)", timeoutMs: 15_000 });
  });

  it("rejects unsupported runtimes and unknown properties", () => {
    expect(sandboxJobInputSchema.safeParse({ runtime: "bash", code: "id" }).success).toBe(false);
    expect(sandboxJobInputSchema.safeParse({ runtime: "node", code: "1", env: { SECRET: "x" } }).success).toBe(false);
  });

  it("caps source size and execution time", () => {
    expect(sandboxJobInputSchema.safeParse({ runtime: "python", code: "x".repeat(MAX_SOURCE_BYTES + 1) }).success).toBe(false);
    expect(sandboxJobInputSchema.safeParse({ runtime: "node", code: "1", timeoutMs: 30_001 }).success).toBe(false);
  });

  it("enforces the UTF-8 source byte limit", () => {
    expect(sandboxJobInputSchema.safeParse({ runtime: "node", code: "é".repeat(MAX_SOURCE_BYTES) }).success).toBe(false);
  });

  it("validates idempotency keys", () => {
    expect(isValidIdempotencyKey("sandbox-job-001")).toBe(true);
    expect(isValidIdempotencyKey("short")).toBe(false);
    expect(isValidIdempotencyKey("bad key value")).toBe(false);
  });
});
