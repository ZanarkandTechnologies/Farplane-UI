import { describe, expect, it } from "vitest";
import { requireFeedScoutObservedDate } from "./discoveries";

describe("Feed Scout discovery dates", () => {
  it("accepts only strict calendar dates at the mutation boundary", () => {
    expect(requireFeedScoutObservedDate("2026-08-12")).toBe("2026-08-12");
    expect(() => requireFeedScoutObservedDate("2026-02-30")).toThrow("feed_scout_observed_date");
    expect(() => requireFeedScoutObservedDate("2026-8-12")).toThrow("feed_scout_observed_date");
  });
});
