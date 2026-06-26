// Resource Bank demo functions seed local QA records behind an explicit confirmation token.
import { v } from "convex/values";
import { mutation } from "../../_generated/server";
import { nowMs } from "./records";
import { seedDemoArgsValidator } from "./validators";

export const seedDemoResourceBank = mutation({
  args: seedDemoArgsValidator,
  returns: v.object({
    jobId: v.id("resourceBankIngestionJobs"),
    assetId: v.id("resourceBankAssets"),
    analysisId: v.id("resourceBankAnalyses"),
    findingId: v.id("resourceBankSkillFindings"),
  }),
  handler: async (ctx, args) => {
    if (args.confirm !== "seed-resource-bank-demo") {
      throw new Error("resource_bank_demo_seed_not_confirmed");
    }
    const timestamp = nowMs();
    const jobId = await ctx.db.insert("resourceBankIngestionJobs", {
      sourceKind: "video",
      sourceRef: "https://example.com/reference-video",
      originalInstruction: "I like the first minute, lighting, and editing structure.",
      note: "Relevant for a video I want to make next week.",
      requestedFocus: "first minute, lighting, editing",
      sourceScope: { startMs: 0, endMs: 60_000 },
      tags: ["intent:future-video", "format:short-video", "style:warm-lighting"],
      projectId: "demo-project",
      taskId: "demo-video-task",
      sourcePrivacy: "public",
      status: "ready",
      createdAtMs: timestamp,
      updatedAtMs: timestamp,
      completedAtMs: timestamp,
    });
    const assetId = await ctx.db.insert("resourceBankAssets", {
      ingestionJobId: jobId,
      assetRole: "primary",
      assetKind: "video",
      title: "Warm lighting video structure reference",
      sourceUrl: "https://example.com/reference-video",
      attributionStatus: "unknown",
      outputTypes: ["reel", "short-video"],
      audiences: ["founders", "operators"],
      ageRanges: ["25-34"],
      industries: ["ai", "saas"],
      customerRoles: ["founder", "creator"],
      tastinessScore: 0.8,
      tags: ["intent:future-video", "format:short-video", "style:warm-lighting"],
      searchableText:
        "Warm lighting video structure reference. Founder and operator audience. AI SaaS reel. First minute has strong hook, soft side key, fast contrast cuts, and reusable editing structure.",
      projectId: "demo-project",
      taskId: "demo-video-task",
      retentionNote: "Source URL retained; no raw media copied in demo seed.",
      createdAtMs: timestamp,
      updatedAtMs: timestamp,
    });
    const analysisId = await ctx.db.insert("resourceBankAnalyses", {
      ingestionJobId: jobId,
      assetId,
      analysisType: "video",
      sourceSkill: "ingest-content",
      facts: ["The requested scope is the first minute."],
      interpretation: ["Warm side lighting separates the subject from a dense background."],
      userIntent: "Reuse the structure, lighting, and editing technique later.",
      whyItWorks: ["The first minute combines a legible hook with quick contrast edits."],
      takeaways: ["Reuse the lighting setup and pacing map without copying the creator."],
      promptGuess: "Warm side-key talking head, dense background, quick contrast cuts.",
      remixConstraints: ["Do not copy the exact footage, creator identity, or caption wording."],
      confidence: "medium",
      embeddingTarget: "analysis_search",
      embeddingText:
        "Warm lighting. First minute video structure. Quick contrast cuts. Reusable short-form editing technique.",
      projectId: "demo-project",
      taskId: "demo-video-task",
      tags: ["intent:future-video", "format:short-video", "style:warm-lighting"],
      createdAtMs: timestamp,
    });
    const findingId = await ctx.db.insert("resourceBankSkillFindings", {
      ingestionJobId: jobId,
      assetId,
      analysisId,
      findingKind: "skill_candidate",
      label: "Short video lighting and edit-structure breakdown",
      capability: "Break down a reference video's lighting, hook timing, and edit rhythm.",
      evidenceAnchor: "0:00-1:00",
      howToReuse: "Use before video generation to produce a pacing and lighting recipe.",
      suggestedSkillChange:
        "Create or extend a video-generation prep skill that outputs lighting, hook, and edit rhythm recipes.",
      tags: ["skill:video-generation", "skill:video-understanding", "style:warm-lighting"],
      confidence: "medium",
      embeddingTarget: "skill_finding_search",
      embeddingText:
        "Skill candidate for video-generation prep: lighting breakdown, first-minute hook timing, edit rhythm.",
      projectId: "demo-project",
      taskId: "demo-video-task",
      createdAtMs: timestamp,
    });
    return { jobId, assetId, analysisId, findingId };
  },
});
