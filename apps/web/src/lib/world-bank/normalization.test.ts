import { describe, expect, it } from "vitest";
import { normalizeDataset, normalizeList } from "./normalization";

describe("World Bank dataset normalization", () => {
  it("accepts the documented dataset identifier and title fields", () => {
    expect(
      normalizeDataset({
        dataset_unique_id: "DS001",
        dataset_title: "Global Development Data",
        dataset_description: "A sample dataset",
      }),
    ).toMatchObject({
      uniqueId: "DS001",
      title: "Global Development Data",
      description: "A sample dataset",
    });
  });

  it("rejects records without a stable id or title", () => {
    expect(normalizeDataset({ dataset_unique_id: "DS001" })).toBeNull();
    expect(normalizeDataset({ dataset_title: "No identifier" })).toBeNull();
  });

  it("normalizes common list envelopes", () => {
    expect(normalizeList({ data: [{ id: "1" }] })).toEqual([{ id: "1" }]);
    expect(normalizeList([{ id: "2" }])).toEqual([{ id: "2" }]);
    expect(normalizeList({ unexpected: true })).toEqual([]);
  });
});
