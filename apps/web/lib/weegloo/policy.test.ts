import { describe, expect, it } from "vitest";
import { isReadOnlyToolAllowed, parseReadOnlyToolAllowlist } from "./policy";

describe("WEEGLOO read-only tool policy", () => {
  it("parses exact tool names from the environment value", () => {
    expect(parseReadOnlyToolAllowlist("cma_ListSpaces, cda_GetContent, ,"))
      .toEqual(new Set(["cma_ListSpaces", "cda_GetContent"]));
  });

  it("allows only explicitly allowlisted read tools", () => {
    const allowlist = parseReadOnlyToolAllowlist("cma_ListSpaces,cda_GetContent");
    expect(isReadOnlyToolAllowed("cma_ListSpaces", allowlist)).toBe(true);
    expect(isReadOnlyToolAllowed("cma_DeleteSpace", allowlist)).toBe(false);
    expect(isReadOnlyToolAllowed("cma_ListUsers", allowlist)).toBe(false);
  });

  it("blocks mutating operations even if accidentally allowlisted", () => {
    const allowlist = parseReadOnlyToolAllowlist(
      "cma_CreateSpace,webHosting_Deploy,script_Run",
    );
    expect(isReadOnlyToolAllowed("cma_CreateSpace", allowlist)).toBe(false);
    expect(isReadOnlyToolAllowed("webHosting_Deploy", allowlist)).toBe(false);
    expect(isReadOnlyToolAllowed("script_Run", allowlist)).toBe(false);
  });

  it("normalizes camel-case operation names before checking mutations", () => {
    const allowlist = parseReadOnlyToolAllowlist("deployWebsite,deleteContent");
    expect(isReadOnlyToolAllowed("deployWebsite", allowlist)).toBe(false);
    expect(isReadOnlyToolAllowed("deleteContent", allowlist)).toBe(false);
  });
});
