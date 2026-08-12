import { describe, expect, it } from "vitest";
import { canLoadOlderTimeline, mergeTimelinePage } from "./timeline-feed";

describe("timeline day feed", () => {
  it("keeps loaded days newest-first and refreshes a subscribed day without duplicating it", () => {
    const newest = [{ id: "newest", label: "first" }];
    const pages = mergeTimelinePage([], "2026-08-12", newest);
    const withOlder = mergeTimelinePage(pages, "2026-08-11", [{ id: "older", label: "second" }]);

    expect(withOlder.map((page) => page.day)).toEqual(["2026-08-12", "2026-08-11"]);
    expect(
      mergeTimelinePage(withOlder, "2026-08-12", [{ id: "newest", label: "updated" }]),
    ).toEqual([
      { day: "2026-08-12", items: [{ id: "newest", label: "updated" }] },
      { day: "2026-08-11", items: [{ id: "older", label: "second" }] },
    ]);
  });

  it("continues through a full day only when an older populated day exists", () => {
    expect(canLoadOlderTimeline("CanLoadMore", null)).toBe(true);
    expect(canLoadOlderTimeline("Exhausted", "2026-08-11")).toBe(true);
    expect(canLoadOlderTimeline("Exhausted", null)).toBe(false);
    expect(canLoadOlderTimeline("LoadingMore", "2026-08-11")).toBe(false);
  });
});
