import { describe, expect, it } from "vitest";

import {
  buildAnalysisEmbeddingText,
  buildResourceBankDashboard,
  buildRetrievalTagPlan,
  buildSkillFindingEmbeddingText,
  mergeTags,
  normalizeTags,
} from "./resourceBank";

describe("resource bank helpers", () => {
  it("normalizes typed tags and dedupes them", () => {
    expect(mergeTags(["Style:Academic Chaos", "format:2x2-grid"], ["style:academic-chaos"])).toEqual([
      "style:academic-chaos",
      "format:2x2-grid",
    ]);
    expect(normalizeTags([" retrieval:Landing Page Inspo "])).toEqual([
      "retrieval:landing-page-inspo",
    ]);
  });

  it("builds explicit embedding text from selected fields", () => {
    const analysisText = buildAnalysisEmbeddingText({
      facts: ["first minute uses warm key light"],
      interpretation: ["contrast cuts keep the open fast"],
      whyItWorks: ["lighting separates face from dense background"],
      takeaways: ["reuse lighting and pacing, not the creator identity"],
      promptGuess: "warm side key, dense desk background, fast jump cuts",
    });
    const skillText = buildSkillFindingEmbeddingText({
      label: "Warm side-key talking-head open",
      capability: "Break down lighting and pacing for short video intros",
      evidenceAnchor: "0:00-1:00",
      howToReuse: "Apply to future video cold opens.",
      tags: ["skill:video-lighting"],
    });

    expect(analysisText).toContain("first minute uses warm key light");
    expect(analysisText).toContain("warm side key");
    expect(skillText).toContain("Break down lighting");
    expect(skillText).toContain("skill:video-lighting");
  });

  it("keeps output type as a retrieval hint instead of a hard filter", () => {
    const plan = buildRetrievalTagPlan({
      tags: ["Intent:AI Office Agent"],
      outputType: "video",
    });

    expect(plan.filterTags).toEqual(["intent:ai-office-agent"]);
    expect(plan.tagExpansions).toEqual(["intent:ai-office-agent", "output:video"]);
  });

  it("builds dashboard clusters from asset and skill-finding tags", () => {
    const dashboard = buildResourceBankDashboard(
      [
        {
          _id: "asset-1",
          title: "Video structure reference",
          assetKind: "video",
          assetRole: "primary",
          tags: ["format:short-video", "style:warm-lighting"],
          searchableText: "lighting editing structure",
          createdAtMs: 10,
          updatedAtMs: 10,
        },
      ],
      [
        {
          _id: "analysis-1",
          assetId: "asset-1",
          analysisType: "video",
          whyItWorks: ["clear structure"],
          takeaways: ["reuse the cold open"],
          remixConstraints: [],
          embeddingText: "clear structure",
          tags: ["format:short-video"],
          createdAtMs: 10,
        },
      ],
      [
        {
          _id: "finding-1",
          assetId: "asset-1",
          findingKind: "skill_candidate",
          label: "Short video structure breakdown",
          capability: "Map hooks and edits",
          evidenceAnchor: "0:00-1:00",
          howToReuse: "Use before video generation.",
          tags: ["skill:video-structure", "format:short-video"],
          embeddingText: "video structure",
          createdAtMs: 10,
        },
      ],
    );

    expect(dashboard.totals).toEqual({
      assetCount: 1,
      skillFindingCount: 1,
      latestSavedAt: 10,
    });
    expect(dashboard.assets[0]?.skillFindings).toHaveLength(1);
    expect(dashboard.clusters.map((cluster) => cluster.key)).toContain("skill:video-structure");
  });
});
