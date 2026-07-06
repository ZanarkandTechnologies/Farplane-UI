import { describe, expect, it } from "vitest";

import {
  buildAnalysisEmbeddingText,
  buildCreativeElementEmbeddingText,
  buildResourceBankDashboard,
  buildRetrievalTagPlan,
  buildSkillFindingEmbeddingText,
  buildTastyPack,
  matchesTastyPackFilters,
  mergeTags,
  normalizeTags,
  resolveTastyPackFilters,
  sortCreativeElementsForTastePack,
} from "./resourceBank";

describe("resource bank helpers", () => {
  it("normalizes typed tags and dedupes them", () => {
    expect(
      mergeTags(["Style:Academic Chaos", "format:2x2-grid"], ["style:academic-chaos"]),
    ).toEqual(["style:academic-chaos", "format:2x2-grid"]);
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
    const elementText = buildCreativeElementEmbeddingText({
      title: "First three seconds hook",
      description: "Reveal with fast caption movement.",
      anchor: "0-3s",
      tags: ["kind:hook"],
    });

    expect(analysisText).toContain("first minute uses warm key light");
    expect(analysisText).toContain("warm side key");
    expect(skillText).toContain("Break down lighting");
    expect(skillText).toContain("skill:video-lighting");
    expect(elementText).toContain("Reveal with fast caption movement");
    expect(elementText).toContain("0-3s");
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
        {
          _id: "asset-thumb-1",
          parentAssetId: "asset-1",
          title: "Video structure reference thumbnail",
          assetKind: "image",
          assetRole: "thumbnail",
          sourceUrl: "https://example.com/thumb.jpg",
          outputTypes: [],
          audiences: [],
          ageRanges: [],
          industries: [],
          customerRoles: [],
          tags: ["format:short-video"],
          searchableText: "thumbnail",
          createdAtMs: 11,
          updatedAtMs: 11,
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
          _id: "element-1",
          assetId: "asset-1",
          kind: "hook",
          title: "Cold open",
          description: "Open on the strongest visual.",
          anchor: "hero",
          pinned: false,
          embeddingText: "cold open",
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
      creativeElementCount: 1,
      skillFindingCount: 1,
      latestSavedAt: 10,
    });
    expect(dashboard.assets[0]?.previewAsset?.sourceUrl).toBe("https://example.com/thumb.jpg");
    expect(dashboard.assets[0]?.derivedAssets).toHaveLength(1);
    expect(dashboard.assets[0]?.creativeElements[0]?.title).toBe("Cold open");
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

  it("builds tasty packs from captures, analysis, and extracted creative elements", () => {
    const filters = resolveTastyPackFilters(
      { timeframe: "past_week", audience: "founders" },
      1_000_000,
    );
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
          operatorNote: "I like the fast identity reveal and want that to drive the video.",
          createdAtMs: 999_000,
          updatedAtMs: 999_000,
        },
      ],
      analyses: [
        {
          _id: "analysis-1",
          assetId: "asset-1",
          analysisType: "video",
          whyItWorks: ["The reel makes an AI employee premise instantly legible."],
          takeaways: ["Operator liked the first three seconds and transformation pattern."],
          remixConstraints: [
            "Audio was not fingerprinted; exact source footage should not be copied.",
          ],
          embeddingText: "AI office employee transformation reel",
          tags: ["style:old-school-corporate"],
          createdAtMs: 999_050,
        },
      ],
      creativeElements: [
        {
          _id: "element-1",
          ingestionJobId: "job-1",
          assetId: "asset-1",
          kind: "hook",
          title: "Office-worker transformation hook",
          description: "The first three seconds show a jarring office-worker transformation.",
          anchor: "0-3s",
          pinned: false,
          embeddingText: "first three seconds office-worker transformation hook",
          tags: ["style:old-school-corporate"],
          createdAtMs: 999_100,
        },
        {
          _id: "element-2",
          ingestionJobId: "job-1",
          assetId: "asset-1",
          kind: "storyboard",
          title: "Agent identity reveal",
          description: "A human office scene flips into an AI employee-agent premise.",
          anchor: "3-8s",
          pinned: true,
          embeddingText: "timeline beat AI office employee agent reveal",
          tags: ["story:agent-reveal"],
          createdAtMs: 999_200,
        },
      ],
    });

    expect(pack.captures).toHaveLength(1);
    expect(pack.captures[0]?.source.sourceHandle).toBe("https://example.com/reel");
    expect(pack.captures[0]?.analysis.operatorNote).toContain("fast identity reveal");
    expect(pack.captures[0]?.analysis.whySaved[0]).toContain("first three seconds");
    expect(pack.captures[0]?.elements.map((element) => element.kind)).toEqual([
      "storyboard",
      "hook",
    ]);
    expect(pack.captures[0]?.elements[0]?.title).toBe("Agent identity reveal");
    expect(pack.captures[0]?.elements[0]?.pinned).toBe(true);
    expect(pack.meta).toEqual({
      captureCount: 1,
      timeframe: "past_week",
      pinnedElementCount: 1,
      operatorNoteCount: 1,
      warnings: [],
    });
  });

  it("sorts creative elements by pinned status, then recency", () => {
    const sorted = sortCreativeElementsForTastePack([
      {
        _id: "ordinary-recent",
        assetId: "asset-1",
        kind: "copy",
        title: "Ordinary recent",
        description: "Useful context.",
        pinned: false,
        embeddingText: "ordinary recent",
        tags: [],
        createdAtMs: 300,
      },
      {
        _id: "pinned-older",
        assetId: "asset-1",
        kind: "hook",
        title: "Pinned older",
        description: "Important operator taste.",
        pinned: true,
        embeddingText: "pinned older",
        tags: [],
        createdAtMs: 100,
      },
      {
        _id: "pinned-newer",
        assetId: "asset-1",
        kind: "storyboard",
        title: "Pinned newer",
        description: "Most important operator taste.",
        pinned: true,
        embeddingText: "pinned newer",
        tags: [],
        createdAtMs: 200,
      },
    ]);

    expect(sorted.map((element) => element._id)).toEqual([
      "pinned-newer",
      "pinned-older",
      "ordinary-recent",
    ]);
  });

  it("warns when an operator note produces no pinned elements", () => {
    const filters = resolveTastyPackFilters({ timeframe: "past_week" }, 1_000_000);
    const pack = buildTastyPack({
      filters,
      assets: [
        {
          _id: "asset-1",
          title: "Unprioritized reel",
          assetKind: "video",
          assetRole: "primary",
          outputTypes: [],
          audiences: [],
          ageRanges: [],
          industries: [],
          customerRoles: [],
          tags: [],
          searchableText: "unprioritized reel",
          operatorNote: "I like the pacing and caption rhythm.",
          createdAtMs: 999_000,
          updatedAtMs: 999_000,
        },
      ],
      analyses: [],
      creativeElements: [
        {
          _id: "element-1",
          assetId: "asset-1",
          kind: "editing",
          title: "Generic jump cuts",
          description: "Fast cuts appear throughout the clip.",
          pinned: false,
          embeddingText: "generic jump cuts",
          tags: [],
          createdAtMs: 999_100,
        },
      ],
    });

    expect(pack.meta.pinnedElementCount).toBe(0);
    expect(pack.meta.operatorNoteCount).toBe(1);
    expect(pack.meta.warnings).toContain(
      "Operator note exists, but no element was pinned from that stated taste.",
    );
  });
});
