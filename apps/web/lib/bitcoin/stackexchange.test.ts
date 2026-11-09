import { describe, expect, it } from "vitest";
import { cleanHtml } from "./stackexchange";

describe("cleanHtml", () => {
  it("removes markup and normalizes entities", () => {
    expect(cleanHtml("<p>SegWit &amp; <b>Bitcoin</b></p>")).toBe("SegWit & Bitcoin");
  });
  it("removes scripts and styles before stripping tags", () => {
    expect(cleanHtml("<script>alert(1)</script><style>body{}</style><p>safe</p>")).toBe("safe");
  });
});
