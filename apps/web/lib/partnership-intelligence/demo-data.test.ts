import { describe, expect, it } from "vitest";
import { partnershipDemoData } from "./demo-data";

describe("partnership intelligence demo data", () => {
  it("identifies all figures and records as synthetic demo content", () => {
    expect(partnershipDemoData.mode).toBe("demo");
    expect(partnershipDemoData.notice.toLowerCase()).toContain("sample data");
    expect(partnershipDemoData.metrics).toHaveLength(4);
    expect(partnershipDemoData.partners.length).toBeGreaterThan(0);
    expect(partnershipDemoData.campaigns.length).toBeGreaterThan(0);
  });
  it("uses unique partner and campaign identifiers", () => {
    const partnerIds = partnershipDemoData.partners.map((partner) => partner.id);
    const campaignIds = partnershipDemoData.campaigns.map((campaign) => campaign.id);
    expect(new Set(partnerIds).size).toBe(partnerIds.length);
    expect(new Set(campaignIds).size).toBe(campaignIds.length);
  });
  it("does not enable external actions by default", () => {
    expect(partnershipDemoData.capabilities.every((capability) => capability.status !== "available")).toBe(true);
    expect(partnershipDemoData.capabilities.some((capability) => capability.status === "approval_required")).toBe(true);
  });
});
