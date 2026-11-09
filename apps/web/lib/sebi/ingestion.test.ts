import { describe, expect, it } from "vitest";
import { classifySebiItem, normalizeSebiUrl, parseSebiRss } from "./ingestion";

describe("SEBI source ingestion", () => {
  it("accepts only HTTPS URLs on approved SEBI hosts", () => {
    expect(normalizeSebiUrl("https://www.sebi.gov.in/legal/circulars/test.html")).toBe("https://www.sebi.gov.in/legal/circulars/test.html");
    expect(normalizeSebiUrl("http://www.sebi.gov.in/test")).toBeNull();
    expect(normalizeSebiUrl("https://example.com/test")).toBeNull();
  });

  it("classifies common regulatory content", () => {
    expect(classifySebiItem("Master Circular on Mutual Funds", "")).toBe("Circular");
    expect(classifySebiItem("Order in the matter of X", "")).toBe("Enforcement");
    expect(classifySebiItem("Investor grievance redressal", "")).toBe("Investor protection");
  });

  it("parses RSS records and discards non-SEBI links", () => {
    const xml = '<?xml version="1.0"?><rss><channel>' +
      '<item><title><![CDATA[SEBI circular & update]]></title><link>https://www.sebi.gov.in/legal/circulars/sample.html</link><description>Official circular</description><pubDate>Tue, 10 Nov 2026 00:00:00 GMT</pubDate></item>' +
      '<item><title>Untrusted link</title><link>https://example.com/fake</link><description>Ignore</description></item>' +
      '</channel></rss>';
    const items = parseSebiRss(xml);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("SEBI circular & update");
    expect(items[0].category).toBe("Circular");
    expect(items[0].publishedAt?.toISOString()).toBe("2026-11-10T00:00:00.000Z");
  });
});
