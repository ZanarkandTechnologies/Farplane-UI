import { describe, expect, it } from "vitest";
import { groupEditorialNewsByDay } from "./editorial-news-layout";

describe("groupEditorialNewsByDay", () => {
  it("keeps source order while grouping consecutive timeline days", () => {
    const groups = groupEditorialNewsByDay([
      { id: "newest", timelineDay: "2026-08-12" },
      { id: "same-day", timelineDay: "2026-08-12" },
      { id: "older", timelineDay: "2026-08-11" },
    ]);

    expect(groups).toEqual([
      {
        day: "2026-08-12",
        items: [
          { id: "newest", timelineDay: "2026-08-12" },
          { id: "same-day", timelineDay: "2026-08-12" },
        ],
      },
      { day: "2026-08-11", items: [{ id: "older", timelineDay: "2026-08-11" }] },
    ]);
  });

  it("places undated legacy records in the final explicit group", () => {
    expect(groupEditorialNewsByDay([{ id: "legacy", timelineDay: null }])).toEqual([
      { day: "Earlier reporting", items: [{ id: "legacy", timelineDay: null }] },
    ]);
  });
});
