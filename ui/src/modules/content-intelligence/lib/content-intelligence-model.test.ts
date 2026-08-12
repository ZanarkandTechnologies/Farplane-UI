import { describe, expect, it } from "vitest";

import type { ContentIntelligenceItem } from "../types";
import {
  contentIntelligencePrimaryTabs,
  contentThumbnailUrl,
  groupContentByObservedDate,
} from "./content-intelligence-model";

it("keeps recurring Topics contextual instead of a primary library destination", () => {
  expect(contentIntelligencePrimaryTabs).toEqual(["content", "news", "concepts", "world"]);
  expect(contentIntelligencePrimaryTabs).not.toContain("topics");
});

function item(id: string, lastObservedAt: string): ContentIntelligenceItem {
  return {
    id,
    sourceKind: "url",
    sourceRef: `https://example.com/${id}`,
    canonicalRef: `https://example.com/${id}`,
    title: id,
    createdAt: lastObservedAt,
    updatedAt: lastObservedAt,
    lastObservedAt,
    latestDiscovery: null,
    jobs: [],
    projectIds: [],
    summarySource: null,
  };
}

describe("groupContentByObservedDate", () => {
  it("groups an unsorted page into a newest-first date timeline", () => {
    expect(
      groupContentByObservedDate([
        item("older", "2026-08-11T09:00:00.000Z"),
        item("same-day", "2026-08-12"),
        item("newest", "2026-08-12T09:00:00.000Z"),
      ]),
    ).toEqual([
      {
        date: "2026-08-12",
        items: [item("newest", "2026-08-12T09:00:00.000Z"), item("same-day", "2026-08-12")],
      },
      { date: "2026-08-11", items: [item("older", "2026-08-11T09:00:00.000Z")] },
    ]);
  });
});

describe("contentThumbnailUrl", () => {
  it("derives the existing YouTube card thumbnail without requesting third-party metadata", () => {
    expect(
      contentThumbnailUrl({
        canonicalRef: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        sourceKind: "video",
      }),
    ).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg");
  });

  it("uses a visual fallback for non-YouTube and non-video sources", () => {
    expect(
      contentThumbnailUrl({
        canonicalRef: "https://example.com/post",
        sourceKind: "url",
      }),
    ).toBeUndefined();
    expect(
      contentThumbnailUrl({
        canonicalRef: "https://example.com/video",
        sourceKind: "video",
      }),
    ).toBeUndefined();
  });
});
