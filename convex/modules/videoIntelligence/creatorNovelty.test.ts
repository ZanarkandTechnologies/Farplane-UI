import { describe, expect, it } from "vitest";
import { tagFindings } from "./creatorNovelty";

const points = [
  { finding: "Sell the outcome, not the hours.", detail: null, timestamp: "0:45" },
  { finding: "[NEW] Elimination beats automation.", detail: "Cut the step first.", timestamp: "1:30" },
];

describe("tagFindings", () => {
  it("puts each verdict in front of its finding and replaces an earlier one", () => {
    expect(tagFindings(points, ["NEW", "RESTATED"])).toEqual([
      { finding: "[NEW] Sell the outcome, not the hours.", detail: null, timestamp: "0:45" },
      { finding: "[RESTATED] Elimination beats automation.", detail: "Cut the step first.", timestamp: "1:30" },
    ]);
  });

  it("refuses verdicts that don't line up with the key points", () => {
    expect(() => tagFindings(points, ["NEW"])).toThrow("video_intelligence_novelty_count_mismatch");
  });
});
