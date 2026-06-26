import { describe, expect, it } from "vitest";

import {
  buildAnalysisEmbeddingText,
  buildResourceBankDashboard,
  buildRetrievalTagPlan,
  buildTastyPack,
  matchesTastyPackFilters,
  buildSkillFindingEmbeddingText,
  mergeTags,
  normalizeTags,
  resolveTastyPackFilters,
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
          outputTypes: [],
          audiences: [],
          ageRanges: [],
          industries: [],
          customerRoles: [],
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

  it("resolves timeframe and customer facets for tasty packs", () => {
    const now = Date.UTC(2026, 5, 26);
    const filters = resolveTastyPackFilters(
      {
        audience: "Busy Founders",
        industry: "AI SaaS",
        outputType: "Short Video",
      },
      now,
    );

    expect(filters.timeframe).toBe("past_week");
    expect(filters.startAtMs).toBe(now - 7 * 24 * 60 * 60 * 1000);
    expect(filters.audiences).toEqual(["busy-founders"]);
    expect(filters.industries).toEqual(["ai-saas"]);
    expect(filters.outputTypes).toEqual(["short-video"]);
  });

  it("matches tasty pack filters by timeframe and audience facets", () => {
    const filters = resolveTastyPackFilters(
      {
        timeframe: "past_month",
        audience: "founders",
        industry: "saas",
        outputType: "reel",
      },
      1_000_000,
    );

    expect(
      matchesTastyPackFilters(
        {
          _id: "asset-1",
          title: "Founder reel",
          assetKind: "video",
          assetRole: "primary",
          outputTypes: ["reel"],
          audiences: ["founders"],
          ageRanges: [],
          industries: ["saas"],
          customerRoles: [],
          tags: [],
          searchableText: "founder reel",
          createdAtMs: 999_000,
          updatedAtMs: 999_000,
        },
        filters,
      ),
    ).toBe(true);

    expect(
      matchesTastyPackFilters(
        {
          _id: "asset-2",
          title: "Student reel",
          assetKind: "video",
          assetRole: "primary",
          outputTypes: ["reel"],
          audiences: ["students"],
          ageRanges: [],
          industries: ["education"],
          customerRoles: [],
          tags: [],
          searchableText: "student reel",
          createdAtMs: 999_000,
          updatedAtMs: 999_000,
        },
        filters,
      ),
    ).toBe(false);
  });

  it("builds tasty packs from recent assets and freeform retention analysis", () => {
    const filters = resolveTastyPackFilters({ timeframe: "past_week", audience: "founders" }, 1_000_000);
    const pack = buildTastyPack({
      idea: "AI office employee agent intro",
      filters,
      assets: [
        {
          _id: "asset-1",
          title: "Old school corporate reel",
          assetKind: "video",
          assetRole: "primary",
          platform: "instagram",
          outputTypes: ["reel"],
          audiences: ["founders"],
          ageRanges: ["25-34"],
          industries: ["ai"],
          customerRoles: ["founder"],
          tastinessScore: 0.9,
          tags: ["style:old-school-corporate"],
          searchableText: "old school corporate reel",
          sourceUrl: "https://example.com/reel",
          attributionStatus: "partial",
          createdAtMs: 999_000,
          updatedAtMs: 999_000,
        },
      ],
      analyses: [
        {
          _id: "analysis-1",
          assetId: "asset-1",
          analysisType: "video",
          whyItWorks: ["The first three seconds show a jarring office-worker transformation."],
          takeaways: ["Use the hook as a self-insert agent cold open."],
          promptGuess: "vintage corporate training video, office agent cameo",
          remixConstraints: ["Do not copy the creator identity."],
          embeddingText: "Hook: the first three seconds pull attention with a strange corporate scene. Retention: each beat adds another office-history gag.",
          tags: ["style:old-school-corporate"],
          createdAtMs: 999_100,
        },
      ],
    });

    expect(pack.assets).toHaveLength(1);
    expect(pack.assets[0]?.retentionNotes[0]).toContain("first three seconds");
    expect(pack.assets[0]?.sourceHandle).toBe("https://example.com/reel");
    expect(pack.packSummary).toContain("Audience filter: founders.");
  });
});
