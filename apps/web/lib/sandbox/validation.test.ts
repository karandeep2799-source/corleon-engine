import { describe, expect, it } from "vitest";
import { isValidIdempotencyKey, sandboxJobInputSchema } from "./validation";

describe("sandboxJobInputSchema", () => {
  it("accepts small Node and Python programs", () => {
    expect(sandboxJobInputSchema.safeParse({ runtime: "node", code: "console.log('ok')" }).success).toBe(true);
    expect(sandboxJobInputSchema.safeParse({ runtime: "python", code: "print('ok')" }).success).toBe(true);
  });

  it("defaults runtime to Node", () => {
    expect(sandboxJobInputSchema.parse({ code: "console.log(1)" }).runtime).toBe("node");
  });

  it("rejects empty, oversized, unknown and extra input fields", () => {
    expect(sandboxJobInputSchema.safeParse({ code: "" }).success).toBe(false);
    expect(sandboxJobInputSchema.safeParse({ code: "x".repeat(12_001) }).success).toBe(false);
    expect(sandboxJobInputSchema.safeParse({ runtime: "bash", code: "echo unsafe" }).success).toBe(false);
    expect(sandboxJobInputSchema.safeParse({ code: "console.log(1)", command: "sh" }).success).toBe(false);
  });
});

describe("isValidIdempotencyKey", () => {
  it("accepts a constrained key and rejects malformed values", () => {
    expect(isValidIdempotencyKey("sandbox-job-123")).toBe(true);
    expect(isValidIdempotencyKey("short")).toBe(false);
    expect(isValidIdempotencyKey("bad key value")).toBe(false);
    expect(isValidIdempotencyKey(null)).toBe(false);
  });
});
