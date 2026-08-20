import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type {
  RelatedCoverageProjection,
  RelatedCoverageReceipt,
} from "../hooks/use-editorial-intelligence";
import {
  DossierBodyContent,
  DossierCitations,
  DossierIntelligenceReceipt,
  DossierShell,
  RelatedCoverageList,
  RelatedCoverageSection,
} from "./content-intelligence-dossier";
import { ContentJobProgress } from "./content-job-progress";
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
    expect(html).toContain('href="https://www.youtube.com/watch?v=9bZkp7q19f0"');
    expect(html).not.toContain("coverageCount");
  });
});

describe("RelatedCoverageSection", () => {
  it("renders projected counts and accepted rows without changing internal dossier navigation", () => {
    const projection = receiptProjection({
      status: "complete",
      candidateCount: 3,
      acceptedCount: 1,
      limitation: "Only distinct configured creators were compared.",
    });
    projection.items = [
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
    ];
    const html = renderToStaticMarkup(
      createElement(RelatedCoverageSection, {
        projection,
        parentTitle: "Parent dossier",
        onOpenDossier: () => {},
      }),
    );

    expect(html).toContain('data-state="matches"');
    expect(html).toContain("Horizon");
    expect(html).toContain("Candidates");
    expect(html).toContain("Accepted");
    expect(html).toContain("2026-08-05 – 2026-08-19");
    expect(html).toContain("Only distinct configured creators were compared.");
    expect(html).toContain("Open comparable take: A different take");
    expect(html).toContain('href="https://www.youtube.com/watch?v=9bZkp7q19f0"');
  });

  it.each([
    ["complete", "complete_zero", "No Comparable Takes Found", 3, 0],
    ["sparse", "sparse", "Comparison Pool Is Sparse", 0, 0],
    ["failed", "failed", "Comparison Check Failed", 2, 0],
    ["not_run", "not_run", "Comparison Not Run", 0, 0],
  ] as const)("renders the projected %s receipt without manufacturing comparison rows", (status, state, title, candidateCount, acceptedCount) => {
    const projection = receiptProjection({
      status,
      candidateCount,
      acceptedCount,
      limitation: `Projected ${status} limitation.`,
    });
    if (status === "not_run") {
      projection.receipt.asOfDay = null;
      projection.receipt.windowStartDay = null;
      projection.receipt.horizonDays = null;
    }
    const html = renderToStaticMarkup(
      createElement(RelatedCoverageSection, {
        projection,
        parentTitle: "Parent dossier",
        onOpenDossier: () => {},
      }),
    );

    expect(html).toContain(`data-state="${state}"`);
    expect(html).toContain(title);
    expect(html).toContain(`Projected ${status} limitation.`);
    expect(html).toContain("Candidates");
    expect(html).toContain("Accepted");
    expect(html).not.toContain("related-coverage-list");
  });
});

describe("Dossier intelligence hierarchy", () => {
  const dossier = {
    id: "dossier-1",
    videoId: "video-1",
    canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    title: "A current release",
    publisher: "Creator One",
    publishedAt: "2026-08-19",
    sourceStatus: "TRANSCRIPT_USED" as const,
    sourceNote: "Transcript and metadata inspected.",
    timelineDay: "2026-08-19",
    summary: "The dossier summary.",
    concepts: [
      "robotics",
      "embodied AI",
      "vision-language-action models",
      "dexterity",
      "robot learning",
      "simulation",
      "reinforcement learning",
    ],
    keyPoints: [{ finding: "A key finding", detail: null, timestamp: "01:00" }],
    stories: [
      {
        id: "story-1",
        title: "Official release",
        eventDate: "2026-08-18",
        referenceUrl: "https://official.example.com/release",
      },
    ],
  };

  it("summarizes source, citation, and comparison outcomes in the final receipt", () => {
    const html = renderToStaticMarkup(
      createElement(DossierIntelligenceReceipt, {
        dossier,
        projection: receiptProjection({
          status: "complete",
          candidateCount: 4,
          acceptedCount: 1,
        }),
      }),
    );

    expect(html).toContain("Intelligence receipt");
    expect(html).toContain("Transcript used");
    expect(html).toContain("Citations");
    expect(html).toContain("1 source");
    expect(html).toContain("1 accepted / 4 checked");
  });

  it("renders citations, Related coverage, and the receipt at the end of the single column", () => {
    const html = renderToStaticMarkup(
      createElement(DossierBodyContent, {
        dossier,
        relatedCoverage: receiptProjection({
          status: "complete",
          candidateCount: 4,
          acceptedCount: 1,
        }),
        onOpenDossier: () => {},
      }),
    );

    expect(html.indexOf("Dossier concepts")).toBeLessThan(html.indexOf("The dossier summary."));
    expect(html.indexOf("The dossier summary.")).toBeLessThan(html.indexOf("Key points"));
    expect(html.indexOf("Key points")).toBeLessThan(html.indexOf("Citations"));
    expect(html.indexOf("Citations")).toBeLessThan(html.indexOf("Related coverage"));
    expect(html.indexOf("Related coverage")).toBeLessThan(html.indexOf("Intelligence receipt"));
    expect(html.match(/>Summary</g)).toHaveLength(1);
    expect(html).not.toContain(">Dossier<");
    expect(html).toContain("Source notes");
    expect(html).toContain("01");
    expect(html).toContain('href="https://official.example.com/release"');
    expect(html).toContain("#robot learning");
    expect(html).not.toContain("#simulation");
    expect(html).not.toContain("#reinforcement learning");
  });

  it("renders every exact external citation and an honest empty state", () => {
    const citedHtml = renderToStaticMarkup(
      createElement(DossierCitations, { stories: dossier.stories }),
    );
    const emptyHtml = renderToStaticMarkup(createElement(DossierCitations, { stories: [] }));

    expect(citedHtml).toContain("Citations");
    expect(citedHtml).toContain("Official release");
    expect(citedHtml).toContain('href="https://official.example.com/release"');
    expect(citedHtml).toContain("Original sources used to verify developments");
    expect(emptyHtml).toContain("No external citations were extracted.");
  });

  it("renders a decorative thumbnail banner before the dossier title", () => {
    const html = renderToStaticMarkup(
      createElement(
        DossierShell,
        {
          title: "A current release",
          canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
          backLabel: "Back to content",
          onBack: () => {},
          "data-testid": "dossier-shell",
        },
        createElement("div", null, "Dossier body"),
      ),
    );

    expect(html.indexOf("dossier-thumbnail-banner")).toBeLessThan(
      html.indexOf("A current release"),
    );
    expect(html).toContain('src="https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg"');
    expect(html).toContain('alt=""');
    expect(html).toContain('fetchPriority="high"');
  });
});

function receiptProjection(
  receipt: Partial<RelatedCoverageReceipt> & Pick<RelatedCoverageReceipt, "status">,
): RelatedCoverageProjection {
  return {
    receipt: {
      status: receipt.status,
      asOfDay: receipt.asOfDay ?? "2026-08-19",
      windowStartDay: receipt.windowStartDay ?? "2026-08-05",
      horizonDays: receipt.horizonDays ?? 14,
      candidateCount: receipt.candidateCount ?? 0,
      acceptedCount: receipt.acceptedCount ?? 0,
      limitation: receipt.limitation ?? null,
    },
    items: [],
  };
}

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
