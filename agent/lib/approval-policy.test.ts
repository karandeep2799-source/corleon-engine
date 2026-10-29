import { describe, expect, it } from "vitest";
import { approvalForTool } from "./approval-policy.js";

describe("approvalForTool", () => {
  it("allows known Sanity read operations", () => {
    expect(approvalForTool("sanity__query_documents")).toBe("not-applicable");
  });

  it("allows known Notion search operations", () => {
    expect(approvalForTool("notion__notion-search")).toBe("not-applicable");
  });

  it("requires approval for Sanity mutations", () => {
    expect(approvalForTool("sanity__patch_documents")).toBe("user-approval");
    expect(approvalForTool("sanity__publish_documents")).toBe("user-approval");
  });

  it("requires approval for Notion creation and updates", () => {
    expect(approvalForTool("notion__notion-create-pages")).toBe("user-approval");
    expect(approvalForTool("notion__notion-update-pages")).toBe("user-approval");
  });

  it("fails closed for unknown tool names", () => {
    expect(approvalForTool("sanity__unknown_operation")).toBe("user-approval");
  });
});
