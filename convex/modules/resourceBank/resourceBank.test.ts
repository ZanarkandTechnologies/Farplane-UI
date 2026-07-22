import { describe, expect, it } from "vitest";
import { assertBrandKitPromptRevision, assertBrandKitRevision } from "./brandKits";

import {
  assertSafeProviderHandles,
  buildAnalysisEmbeddingText,
  buildBrandKitIdempotencyHash,
  buildBrandKitProductionSnapshot,
  buildBrandKitSourceSnapshotHash,
  buildCreativeElementEmbeddingText,
  buildResourceBankDashboard,
  buildRetrievalTagPlan,
  buildSkillFindingEmbeddingText,
  buildTastyPack,
  looksLikeSecret,
  mapResourceKindToBrandKitKind,
  matchesTastyPackFilters,
  mergeTags,
  normalizeBrandKitId,
  normalizeBrandKitPromptInput,
  normalizeBrandKitSlug,
  normalizeTags,
  resolveTastyPackFilters,
  sortCreativeElementsForTastePack,
  stableHash,
} from "./resourceBank";

describe("resource bank helpers", () => {
  it("rejects stale optimistic Brand Kit and prompt revisions", () => {
    expect(() => assertBrandKitRevision({ revision: 4 }, 4)).not.toThrow();
    expect(() => assertBrandKitRevision({ revision: 4 }, 3)).toThrow("brand_kit_revision_mismatch");
    expect(() => assertBrandKitPromptRevision({ revision: 2 }, 2)).not.toThrow();
    expect(() => assertBrandKitPromptRevision({ revision: 2 }, 1)).toThrow(
      "brand_kit_prompt_revision_mismatch",
    );
  });

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
      whyItWorks: "The motion gives the viewer an immediate before/after.",
      goldenExampleDescription: "Opening caption crosses the frame.",
      goldenRecipe: "Generate a 3-second opening with fast caption motion and a clear reveal.",
      anchor: "0-3s",
      tags: ["kind:hook"],
    });

    expect(analysisText).toContain("first minute uses warm key light");
    expect(analysisText).toContain("warm side key");
    expect(skillText).toContain("Break down lighting");
    expect(skillText).toContain("skill:video-lighting");
    expect(elementText).toContain("Reveal with fast caption movement");
    expect(elementText).toContain("immediate before/after");
    expect(elementText).toContain("Generate a 3-second opening");
    expect(elementText).toContain("0-3s");
  });

  it("normalizes Brand Kit ids and preserves Resource Bank kinds in kit snapshots", () => {
    expect(normalizeBrandKitSlug(" Farplane Creator Kit! ")).toBe("farplane-creator-kit");
    expect(normalizeBrandKitId(" Farplane Creator Kit! ")).toBe("brand-kit:farplane-creator-kit");
    expect(normalizeBrandKitId("brand-kit:farplane-creator-kit")).toBe(
      "brand-kit:farplane-creator-kit",
    );
    expect(mapResourceKindToBrandKitKind("hook")).toBe("hook");
    expect(mapResourceKindToBrandKitKind("copy")).toBe("copy");
    expect(mapResourceKindToBrandKitKind("storyboard")).toBe("storyboard");
    expect(mapResourceKindToBrandKitKind("constraint")).toBe("constraint");
  });

  it("creates stable snapshot hashes independent of object key order", () => {
    expect(stableHash({ title: "Cold open", tags: ["a", "b"] })).toBe(
      stableHash({ tags: ["a", "b"], title: "Cold open" }),
    );
    expect(stableHash({ title: "Cold open" })).not.toBe(stableHash({ title: "Warm open" }));
  });

  it("keeps Brand Kit source snapshot hashes independent of promotion idempotency", () => {
    const snapshotInput = {
      kind: "hook" as const,
      title: "Cold open",
      description: "Open on the strongest visual.",
      whyItWorks: "Immediate visual proof reduces setup time.",
      goldenExample: { title: "Source", sourceUrl: "https://example.com/source" },
      goldenRecipe: "Generate a cold open built around the strongest visual proof.",
      tags: ["format:short-video"],
    };
    expect(buildBrandKitSourceSnapshotHash(snapshotInput)).toBe(
      buildBrandKitSourceSnapshotHash({ ...snapshotInput }),
    );
  });

  it("keeps Brand Kit snapshot identity stable across Resource Bank reingests", () => {
    const input = {
      kind: "visual" as const,
      title: "Centered product reveal",
      description: "Reveal the product in a clean centered frame.",
      whyItWorks: "The centered composition keeps the payoff legible on mobile.",
      goldenExample: { title: "Source post", sourceUrl: "https://example.com/post" },
      goldenRecipe: "Generate a centered product reveal with a clean mobile-safe frame.",
      tags: ["format:reel"],
    };
    expect(buildBrandKitSourceSnapshotHash(input)).toBe(buildBrandKitSourceSnapshotHash(input));
    expect(
      buildBrandKitIdempotencyHash("ingest:post", buildBrandKitSourceSnapshotHash(input)),
    ).toBe(buildBrandKitIdempotencyHash("ingest:post", buildBrandKitSourceSnapshotHash(input)));
    expect(
      buildBrandKitIdempotencyHash(
        "ingest:post",
        buildBrandKitSourceSnapshotHash({
          ...input,
          goldenRecipe: "Generate a wider product reveal with the same mobile-safe payoff.",
        }),
      ),
    ).not.toBe(buildBrandKitIdempotencyHash("ingest:post", buildBrandKitSourceSnapshotHash(input)));
    expect(
      buildBrandKitSourceSnapshotHash({
        ...input,
        goldenExample: { title: "Different crop", sourceUrl: "https://example.com/post#crop" },
      }),
    ).not.toBe(buildBrandKitSourceSnapshotHash(input));
  });

  it("rejects provider handles that look like secrets", () => {
    expect(looksLikeSecret("voice_abc123")).toBe(false);
    expect(looksLikeSecret("sk_live_1234567890")).toBe(true);
    expect(() =>
      assertSafeProviderHandles([
        { provider: "elevenlabs", handleKind: "voice_id", handle: "voice_abc123" },
      ]),
    ).not.toThrow();
    expect(() =>
      assertSafeProviderHandles([
        {
          provider: "elevenlabs",
          handleKind: "voice_id",
          handle: "sk_1234567890abcdef1234567890abcdef",
        },
      ]),
    ).toThrow("brand_kit_provider_handle_looks_secret");
  });

  it("normalizes one Brand Kit prompt and rejects prompt secrets", () => {
    const prompt = normalizeBrandKitPromptInput(
      {
        text: " Use Anam avatar X, Seedance 2, 9:16, and captioned low-poly constraints. ",
      },
      undefined,
      100,
    );

    expect(prompt).toEqual({
      text: "Use Anam avatar X, Seedance 2, 9:16, and captioned low-poly constraints.",
      revision: 1,
      updatedAtMs: 100,
    });

    const updated = normalizeBrandKitPromptInput({ text: "Tighter opening hook." }, prompt, 200);
    expect(updated).toEqual({
      text: "Tighter opening hook.",
      revision: 2,
      updatedAtMs: 200,
    });

    expect(() =>
      normalizeBrandKitPromptInput(
        { text: "Use sk_1234567890abcdef1234567890abcdef for the render." },
        undefined,
        300,
      ),
    ).toThrow("brand_kit_prompt_text_looks_secret");
  });

  it("builds immutable Brand Kit production snapshots with one prompt and full approved elements", () => {
    const kit = {
      kitId: "brand-kit:test",
      slug: "test",
      name: "Test",
      status: "active" as const,
      revision: 8,
      prompt: {
        text: "Captioned Low-Poly Explainer: keep subtitles large and use approved voice.",
        revision: 3,
        updatedAtMs: 88,
      },
      elements: [
        {
          elementId: "manual:hook",
          kind: "hook" as const,
          title: "Deadpan opening line",
          description: "Open with a dry one-line premise.",
          whyItWorks: "The understated delivery lets the visual absurdity land.",
          goldenExample: { title: "Opening line", sourceUrl: "https://example.com/open" },
          goldenRecipe: "Write one short deadpan line that makes the premise obvious.",
          tags: [],
          provenance: {
            promotedFrom: "manual" as const,
            promotedAtMs: 10,
          },
          sourceSnapshotHash: "hash",
          approvedAtMs: 10,
        },
        {
          elementId: "manual:visual",
          kind: "visual" as const,
          title: "Low-poly city",
          description: "Use the approved low-poly office city style.",
          whyItWorks: "The low-poly geometry makes the office world recognizable but ownable.",
          goldenExample: { title: "Low-poly city", sourceUrl: "https://example.com/city" },
          goldenRecipe: "Generate a low-poly office city with bright simple geometry.",
          tags: [],
          provenance: {
            promotedFrom: "manual" as const,
            promotedAtMs: 11,
          },
          sourceSnapshotHash: "hash-2",
          approvedAtMs: 11,
        },
      ],
      createdAtMs: 1,
      updatedAtMs: 2,
    };

    const snapshot = buildBrandKitProductionSnapshot({
      kit,
      snapshotCreatedAtMs: 99,
    });

    expect(snapshot.kitRevision).toBe(8);
    expect(snapshot.prompt).toEqual(kit.prompt);
    expect(snapshot.elements.map((element) => element.elementId)).toEqual([
      "manual:hook",
      "manual:visual",
    ]);
    expect(snapshot.elements[0]?.goldenRecipe).toContain("deadpan");
    expect(snapshot.kit.elements).toEqual(snapshot.elements);
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
          whyItWorks: "The viewer understands the payoff before the explanation starts.",
          goldenExample: {
            assetId: "asset-1",
            description: "Hero frame with the clearest visual proof.",
          },
          goldenRecipe: "Generate a cold open that starts on the strongest proof frame.",
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
    expect(dashboard.assets[0]?.previewStatus.state).toBe("ready");
    expect(dashboard.assets[0]?.derivedAssets).toHaveLength(1);
    expect(dashboard.assets[0]?.creativeElements[0]?.title).toBe("Cold open");
    expect(dashboard.assets[0]?.skillFindings).toHaveLength(1);
    expect(dashboard.clusters.map((cluster) => cluster.key)).toContain("skill:video-structure");
  });

  it("marks source-only video assets when no browser preview was stored", () => {
    const dashboard = buildResourceBankDashboard(
      [
        {
          _id: "asset-1",
          title: "Instagram source-only reference",
          assetKind: "video",
          assetRole: "primary",
          sourceUrl: "https://www.instagram.com/p/example/",
          outputTypes: [],
          audiences: [],
          ageRanges: [],
          industries: [],
          customerRoles: [],
          tags: ["instagram"],
          searchableText: "source only",
          createdAtMs: 10,
          updatedAtMs: 10,
        },
      ],
      [],
      [],
      [],
    );

    expect(dashboard.assets[0]?.previewAsset).toBeUndefined();
    expect(dashboard.assets[0]?.previewStatus).toEqual({
      state: "source_handle",
      message:
        "Source reference is saved, but no browser-displayable thumbnail or contact sheet is stored.",
    });
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
          whyItWorks: "The transformation makes the AI employee premise legible immediately.",
          goldenExample: {
            assetId: "asset-1",
            description: "Opening transformation beat.",
          },
          goldenRecipe:
            "Generate a 3-second office-worker transformation that reveals the AI employee premise.",
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
          whyItWorks: "The scene flip gives the abstract product idea a visible before/after.",
          goldenExample: {
            assetId: "asset-1",
            description: "Human office scene flips into agent identity.",
          },
          goldenRecipe:
            "Storyboard a human office scene that flips into an AI employee-agent reveal.",
          anchor: "3-8s",
          pinned: true,
          embeddingText: "timeline beat AI office employee agent reveal",
          tags: ["story:agent-reveal"],
          createdAtMs: 999_200,
        },
        {
          _id: "element-3",
          ingestionJobId: "job-1",
          assetId: "asset-1",
          kind: "character",
          title: "Deadpan legacy-office guide",
          description: "A dry corporate-training host makes the AI employee premise feel familiar.",
          whyItWorks: "The familiar guide lowers friction for an unfamiliar AI concept.",
          goldenExample: {
            assetId: "asset-1",
            description: "Deadpan host introducing the premise.",
          },
          goldenRecipe:
            "Create a dry corporate-training guide who introduces the AI employee plainly.",
          pinned: true,
          embeddingText: "deadpan old-school corporate guide character",
          tags: ["character:corporate-guide"],
          createdAtMs: 999_300,
        },
      ],
    });

    expect(pack.captures).toHaveLength(1);
    expect(pack.captures[0]?.source.sourceHandle).toBe("https://example.com/reel");
    expect(pack.captures[0]?.analysis.operatorNote).toContain("fast identity reveal");
    expect(pack.captures[0]?.analysis.whySaved[0]).toContain("first three seconds");
    expect(pack.captures[0]?.elements.map((element) => element.kind)).toEqual([
      "character",
      "storyboard",
      "hook",
    ]);
    expect(pack.captures[0]?.elements[0]?.title).toBe("Deadpan legacy-office guide");
    expect(pack.captures[0]?.elements[0]?.pinned).toBe(true);
    expect(pack.captures[0]?.elements[0]?.whyItWorks).toContain("familiar guide");
    expect(pack.captures[0]?.elements[0]?.goldenExample).toEqual({
      assetId: "asset-1",
      description: "Deadpan host introducing the premise.",
    });
    expect(pack.captures[0]?.elements[0]?.goldenRecipe).toContain("corporate-training guide");
    expect(pack.meta).toEqual({
      captureCount: 1,
      timeframe: "past_week",
      pinnedElementCount: 2,
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
        whyItWorks: "The wording stays direct enough to scan.",
        goldenExample: { assetId: "asset-1", description: "Direct caption line." },
        goldenRecipe: "Write concise direct caption copy.",
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
        whyItWorks: "The hook reflects the operator-stated priority.",
        goldenExample: { assetId: "asset-1", description: "Pinned hook frame." },
        goldenRecipe: "Generate a hook around the operator-stated priority.",
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
        whyItWorks: "The newer storyboard better reflects the saved taste.",
        goldenExample: { assetId: "asset-1", description: "Pinned storyboard beat." },
        goldenRecipe: "Storyboard the most important saved taste beat.",
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
          whyItWorks: "The cuts keep momentum even without a pinned operator preference.",
          goldenExample: { assetId: "asset-1", description: "Jump-cut sequence." },
          goldenRecipe: "Edit with fast jump cuts while keeping the message readable.",
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
