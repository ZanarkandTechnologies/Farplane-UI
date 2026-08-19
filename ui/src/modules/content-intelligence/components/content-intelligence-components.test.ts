import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ContentJobProgress } from "./content-job-progress";
import { RelatedCoverageList } from "./content-intelligence-dossier";
import { OriginalSourceLink } from "./editorial-news-briefing";

describe("ContentJobProgress", () => {
  it("renders persisted stage, message, freshness, status, and the read-only retry exit", () => {
    const html = renderToStaticMarkup(
      createElement(ContentJobProgress, {
        item: {
          canonicalRef: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          jobs: [
            {
              id: "job-1",
              kind: "analyze_youtube",
              status: "needs_review",
              progress: {
                stage: "needs_review",
                message: "Check the extracted source evidence.",
                updatedAt: "2026-08-19T10:00:00.000Z",
              },
              updatedAt: "2026-08-19T10:00:00.000Z",
            },
          ],
        },
        nowMs: Date.parse("2026-08-19T10:03:00.000Z"),
      }),
    );

    expect(html).toContain("Needs review");
    expect(html).toContain("Check the extracted source evidence.");
    expect(html).toContain("Updated 3m ago");
    expect(html).toContain("Open source to retry");
    expect(html).toContain("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(html).not.toMatch(/percent|%/i);
  });
});

describe("RelatedCoverageList", () => {
  it("renders a flat comparable take with relationship, rationale, creator, date, and source", () => {
    const html = renderToStaticMarkup(
      createElement(RelatedCoverageList, {
        parentTitle: "Parent dossier",
        onOpenDossier: () => {},
        items: [
          {
            id: "edge-1",
            dossierId: "dossier-2",
            sourceId: "source-2",
            title: "A different take",
            publisher: "Creator Two",
            canonicalUrl: "https://www.youtube.com/watch?v=9bZkp7q19f0",
            summary: "The creator focuses on deployment constraints.",
            relationship: "same_development",
            rationale: "Both discuss the same dated model release.",
            timelineDay: "2026-08-18",
          },
        ],
      }),
    );

    expect(html).toContain("Creator Two");
    expect(html).toContain("Same development");
    expect(html).toContain("Creator take:");
    expect(html).toContain("Both discuss the same dated model release.");
    expect(html).toContain("2026-08-18");
    expect(html).toContain("Open creator source");
    expect(html).not.toContain("coverageCount");
  });
});

describe("OriginalSourceLink", () => {
  it("uses the direct reference URL rather than a featured creator video", () => {
    const html = renderToStaticMarkup(
      createElement(OriginalSourceLink, {
        referenceUrl: "https://official.example.com/releases/model",
      }),
    );

    expect(html).toContain('href="https://official.example.com/releases/model"');
    expect(html).toContain("Original source");
    expect(html).not.toContain("youtube.com");
  });
});
