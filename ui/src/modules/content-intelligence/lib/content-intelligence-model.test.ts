import { describe, expect, it } from "vitest";

import type {
  RelatedCoverageProjection,
  RelatedCoverageReceipt,
} from "../hooks/use-editorial-intelligence";
import type { ContentIntelligenceItem } from "../types";
import {
  contentIntelligencePrimaryTabs,
  contentJobProgressView,
  contentThumbnailUrl,
  dossierBackLabel,
  groupContentByObservedDate,
  latestAnalyzeYoutubeJob,
  projectContentConcepts,
  relatedCoverageReceiptView,
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

function relatedProjection(
  receipt: Partial<RelatedCoverageReceipt> & Pick<RelatedCoverageReceipt, "status">,
  withItem = false,
): RelatedCoverageProjection {
  return {
    receipt: {
      status: receipt.status,
      asOfDay: receipt.asOfDay ?? "2026-08-19",
      windowStartDay: receipt.windowStartDay ?? "2026-08-05",
      horizonDays: receipt.horizonDays ?? 14,
      candidateCount: receipt.candidateCount ?? (withItem ? 3 : 0),
      acceptedCount: receipt.acceptedCount ?? (withItem ? 1 : 0),
      limitation: receipt.limitation ?? null,
    },
    items: withItem
      ? [
          {
            id: "edge-1",
            dossierId: "dossier-2",
            sourceId: "source-2",
            title: "A different take",
            publisher: "Creator Two",
            canonicalUrl: "https://www.youtube.com/watch?v=9bZkp7q19f0",
            summary: "Deployment constraints.",
            relationship: "same_development",
            rationale: "The same dated release.",
            timelineDay: "2026-08-18",
          },
        ]
      : [],
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

describe("contentJobProgressView", () => {
  it("prioritizes the latest YouTube analysis over newer jobs of other kinds", () => {
    const source = item("source", "2026-08-19T10:00:00.000Z");
    source.jobs = [
      {
        id: "save-newer",
        kind: "save_reference",
        status: "ready",
        progress: null,
        updatedAt: "2026-08-19T10:05:00.000Z",
      },
      {
        id: "analysis-older",
        kind: "analyze_youtube",
        status: "failed",
        progress: {
          stage: "failed",
          message: "Transcript could not be recovered.",
          updatedAt: "2026-08-19T10:04:00.000Z",
        },
        updatedAt: "2026-08-19T10:04:00.000Z",
      },
    ];

    expect(latestAnalyzeYoutubeJob(source)?.id).toBe("analysis-older");
    expect(contentJobProgressView(source, Date.parse("2026-08-19T10:09:00.000Z"))).toEqual({
      jobId: "analysis-older",
      status: "failed",
      statusLabel: "Failed",
      stageLabel: "Failed",
      message: "Transcript could not be recovered.",
      freshnessLabel: "Updated 5m ago",
      updatedAt: "2026-08-19T10:04:00.000Z",
      action: { kind: "open_source", label: "Open source to retry" },
    });
  });

  it("uses honest legacy fallbacks without inventing percentage progress", () => {
    const source = item("legacy", "2026-08-19T10:00:00.000Z");
    source.jobs = [
      {
        id: "analysis-active",
        kind: "analyze_youtube",
        status: "analyzing",
        progress: null,
        updatedAt: "2026-08-19T10:00:00.000Z",
      },
    ];

    const view = contentJobProgressView(source, Date.parse("2026-08-19T10:00:30.000Z"));
    expect(view).toMatchObject({
      status: "active",
      stageLabel: "Analysis",
      message: "Analysis is running.",
      freshnessLabel: "Updated just now",
      action: null,
    });
    expect(JSON.stringify(view)).not.toMatch(/percent|%/i);
  });
});

describe("projectContentConcepts", () => {
  it("combines bounded dossier concepts and discovery tags once per source", () => {
    const first = item("first", "2026-08-19");
    first.concepts = ["Robotics", "Gemini"];
    first.latestDiscovery = {
      origin: "feed_scout",
      observedDate: "2026-08-19",
      entityGroupId: "ai",
      feedSourceId: "feed",
      externalKey: "first",
      evidenceRefs: [],
      tags: ["robotics"],
    };
    const second = item("second", "2026-08-18");
    second.concepts = ["Robotics"];

    expect(projectContentConcepts([first, second])).toEqual([
      { name: "Robotics", sources: 2 },
      { name: "Gemini", sources: 1 },
    ]);
  });
});

describe("dossierBackLabel", () => {
  it("names the exact parent dossier for a comparable-take return", () => {
    expect(
      dossierBackLabel({
        fromDossierId: "parent-dossier",
        fromDossierTitle: "Gemini Robotics 2 launch analysis",
      }),
    ).toBe("Back to Gemini Robotics 2 launch analysis");
  });
});

describe("relatedCoverageReceiptView", () => {
  it("renders accepted items as matches while preserving the projected receipt counts and window", () => {
    expect(
      relatedCoverageReceiptView(
        relatedProjection(
          {
            status: "complete",
            candidateCount: 1_234,
            acceptedCount: 1,
            limitation: "Only configured, distinct creators were eligible.",
          },
          true,
        ),
      ),
    ).toEqual({
      state: "matches",
      title: "Comparable Takes Found",
      summary: "Accepted creator videos are listed below.",
      windowLabel: "2026-08-05 – 2026-08-19",
      horizonLabel: "14 days",
      candidateLabel: "1,234",
      acceptedLabel: "1",
      limitation: "Only configured, distinct creators were eligible.",
    });
  });

  it.each([
    ["complete", "complete_zero", "No Comparable Takes Found"],
    ["sparse", "sparse", "Comparison Pool Is Sparse"],
    ["failed", "failed", "Comparison Check Failed"],
    ["not_run", "not_run", "Comparison Not Run"],
  ] as const)("derives the %s empty receipt as %s", (status, state, title) => {
    const projection = relatedProjection({ status, limitation: `Projected ${status} limit.` });
    if (status === "not_run") {
      projection.receipt.asOfDay = null;
      projection.receipt.windowStartDay = null;
      projection.receipt.horizonDays = null;
    }

    expect(relatedCoverageReceiptView(projection)).toMatchObject({
      state,
      title,
      windowLabel: status === "not_run" ? "Not recorded" : "2026-08-05 – 2026-08-19",
      horizonLabel: status === "not_run" ? "Not recorded" : "14 days",
      candidateLabel: "0",
      acceptedLabel: "0",
      limitation: `Projected ${status} limit.`,
    });
  });
});
