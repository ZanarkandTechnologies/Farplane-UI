import { describe, expect, it } from "vitest";
import { isTimelineDay, timelineDayFromMs, timelineDayFromValue } from "./timeline";

describe("Content Intelligence timeline days", () => {
  it("uses the UTC calendar day rather than a local browser date", () => {
    expect(timelineDayFromMs(Date.parse("2026-08-11T23:30:00-05:00"))).toBe("2026-08-12");
  });

  it("retains an exact evidence day and safely falls back for invalid values", () => {
    expect(timelineDayFromValue("2026-07-04", Date.parse("2026-08-12T00:00:00Z"))).toBe(
      "2026-07-04",
    );
    expect(timelineDayFromValue("not a date", Date.parse("2026-08-12T00:00:00Z"))).toBe(
      "2026-08-12",
    );
  });

  it("only accepts canonical calendar-day keys at the query boundary", () => {
    expect(isTimelineDay("2026-08-12")).toBe(true);
    expect(isTimelineDay("2026-8-12")).toBe(false);
    expect(isTimelineDay("2026-02-30")).toBe(false);
  });
});
