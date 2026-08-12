/** Explicit Resource Bank Save entrypoint; it creates a generic save job and never a legacy ingestion job. */
import { v } from "convex/values";
import { mutation } from "../../_generated/server";
import { shouldDeleteContentSource } from "./intelligenceProjectionModel";
import { ensureContentSource } from "./records";

const sourceKind = v.union(
  v.literal("url"),
  v.literal("image"),
  v.literal("video"),
  v.literal("audio"),
  v.literal("file"),
  v.literal("note"),
  v.literal("screenshot"),
  v.literal("clip"),
);
const assetKind = v.union(
  v.literal("url"),
  v.literal("image"),
  v.literal("video"),
  v.literal("audio"),
  v.literal("file"),
  v.literal("note"),
  v.literal("screenshot"),
  v.literal("clip"),
);

export const saveReference = mutation({
  args: {
    sourceKind,
    sourceRef: v.string(),
    title: v.string(),
    assetKind,
    note: v.optional(v.string()),
    originalInstruction: v.optional(v.string()),
    requestedFocus: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    sourceUrl: v.optional(v.string()),
    canonicalUrl: v.optional(v.string()),
    platform: v.optional(v.string()),
    author: v.optional(v.string()),
    sourcePrivacy: v.optional(
      v.union(v.literal("public"), v.literal("local"), v.literal("private"), v.literal("unknown")),
    ),
    projectId: v.optional(v.string()),
    taskId: v.optional(v.string()),
    searchableText: v.optional(v.string()),
    retentionNote: v.optional(v.string()),
    analysisMarkdown: v.optional(v.string()),
    confidence: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"))),
  },
  returns: v.object({
    sourceId: v.id("contentSources"),
    jobId: v.id("contentJobs"),
    assetId: v.id("resourceBankAssets"),
    analysisId: v.optional(v.id("resourceBankAnalyses")),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const title = clean(args.title, 240) || "Untitled resource";
    const sourceRef = clean(args.sourceRef, 2_000);
    if (!sourceRef) throw new Error("missing_source_ref");
    const canonicalUrl = clean(args.canonicalUrl ?? args.sourceUrl ?? sourceRef, 2_000);
    const tags = [...new Set((args.tags ?? []).map((tag) => clean(tag, 120)).filter(Boolean))];
    const sourceId = await ensureContentSource(ctx, {
      sourceKind: args.sourceKind,
      sourceRef,
      canonicalRef: canonicalUrl,
      title,
      platform: clean(args.platform ?? "", 120) || undefined,
      sourcePrivacy: args.sourcePrivacy ?? "unknown",
      now,
    });
    const jobId = await ctx.db.insert("contentJobs", {
      sourceId,
      kind: "save_reference",
      originalInstruction: clean(args.originalInstruction ?? "", 2_000) || undefined,
      note: clean(args.note ?? "", 2_000) || undefined,
      requestedFocus: clean(args.requestedFocus ?? "", 500) || undefined,
      tags,
      projectId: clean(args.projectId ?? "", 120) || undefined,
      taskId: clean(args.taskId ?? "", 120) || undefined,
      status: "ready",
      createdAtMs: now,
      updatedAtMs: now,
      completedAtMs: now,
    });
    const assetId = await ctx.db.insert("resourceBankAssets", {
      contentSourceId: sourceId,
      contentJobId: jobId,
      assetRole: "primary",
      assetKind: args.assetKind,
      title,
      sourceUrl: clean(args.sourceUrl ?? sourceRef, 2_000) || undefined,
      canonicalUrl,
      platform: clean(args.platform ?? "", 120) || undefined,
      author: clean(args.author ?? "", 240) || undefined,
      attributionStatus: args.author ? "known" : "unknown",
      outputTypes: [],
      audiences: [],
      ageRanges: [],
      industries: [],
      customerRoles: [],
      tags,
      searchableText:
        clean(args.searchableText ?? "", 6_000) || `${title}\n${sourceRef}\n${tags.join("\n")}`,
      projectId: clean(args.projectId ?? "", 120) || undefined,
      taskId: clean(args.taskId ?? "", 120) || undefined,
      retentionNote: clean(args.retentionNote ?? "", 1_000) || undefined,
      createdAtMs: now,
      updatedAtMs: now,
    });
    const markdown = clean(args.analysisMarkdown ?? "", 12_000);
    const analysisId = markdown
      ? await ctx.db.insert("resourceBankAnalyses", {
          contentJobId: jobId,
          assetId,
          sourceSkill: "ingest-content",
          analysisMarkdown: markdown,
          confidence: args.confidence ?? "medium",
          embeddingTarget: "analysis_search",
          embeddingText: markdown,
          projectId: clean(args.projectId ?? "", 120) || undefined,
          taskId: clean(args.taskId ?? "", 120) || undefined,
          tags,
          createdAtMs: now,
        })
      : undefined;
    return { sourceId, jobId, assetId, analysisId };
  },
});

/** Confirmation-gated removal for a saved reference with no dependent reusable elements. */
export const deleteSavedReference = mutation({
  args: {
    confirm: v.string(),
    sourceId: v.id("contentSources"),
    jobId: v.id("contentJobs"),
    assetId: v.id("resourceBankAssets"),
  },
  returns: v.object({ deleted: v.boolean() }),
  handler: async (ctx, args) => {
    if (args.confirm !== "delete-content-save-reference")
      throw new Error("content_save_delete_not_confirmed");
    const [job, asset, analyses, elements] = await Promise.all([
      ctx.db.get(args.jobId),
      ctx.db.get(args.assetId),
      ctx.db
        .query("resourceBankAnalyses")
        .withIndex("by_asset", (q) => q.eq("assetId", args.assetId))
        .take(100),
      ctx.db
        .query("resourceBankCreativeElements")
        .withIndex("by_asset", (q) => q.eq("assetId", args.assetId))
        .take(1),
    ]);
    if (
      !job ||
      job.kind !== "save_reference" ||
      job.sourceId !== args.sourceId ||
      asset?.contentJobId !== args.jobId ||
      elements.length
    ) {
      throw new Error("content_save_delete_binding_invalid");
    }
    await Promise.all(analyses.map((analysis) => ctx.db.delete(analysis._id)));
    await ctx.db.delete(args.assetId);
    await ctx.db.delete(args.jobId);
    const [remainingJobs, remainingDiscoveries] = await Promise.all([
      ctx.db
        .query("contentJobs")
        .withIndex("by_source", (q) => q.eq("sourceId", args.sourceId))
        .take(1),
      ctx.db
        .query("contentDiscoveries")
        .withIndex("by_source", (q) => q.eq("contentSourceId", args.sourceId))
        .take(1),
    ]);
    if (
      shouldDeleteContentSource({
        remainingJobCount: remainingJobs.length,
        remainingDiscoveryCount: remainingDiscoveries.length,
      })
    ) {
      await ctx.db.delete(args.sourceId);
    }
    return { deleted: true };
  },
});

export const addPinnedElement = mutation({
  args: {
    jobId: v.id("contentJobs"),
    assetId: v.id("resourceBankAssets"),
    analysisId: v.optional(v.id("resourceBankAnalyses")),
    kind: v.union(
      v.literal("visual"),
      v.literal("audio"),
      v.literal("storyboard"),
      v.literal("editing"),
      v.literal("character"),
      v.literal("format"),
    ),
    title: v.string(),
    description: v.string(),
    whyItWorks: v.string(),
    goldenRecipe: v.string(),
    anchor: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  returns: v.id("resourceBankCreativeElements"),
  handler: async (ctx, args) => {
    const [job, asset, analysis] = await Promise.all([
      ctx.db.get(args.jobId),
      ctx.db.get(args.assetId),
      args.analysisId ? ctx.db.get(args.analysisId) : null,
    ]);
    if (
      !job ||
      job.kind !== "save_reference" ||
      asset?.contentJobId !== args.jobId ||
      (analysis && analysis.contentJobId !== args.jobId)
    )
      throw new Error("content_save_element_binding_invalid");
    const now = Date.now();
    return await ctx.db.insert("resourceBankCreativeElements", {
      contentJobId: args.jobId,
      assetId: args.assetId,
      analysisId: args.analysisId,
      kind: args.kind,
      title: clean(args.title, 240),
      description: clean(args.description, 2_000),
      whyItWorks: clean(args.whyItWorks, 2_000),
      goldenExample: { assetId: args.assetId },
      goldenRecipe: clean(args.goldenRecipe, 4_000),
      anchor: args.anchor ? clean(args.anchor, 240) : undefined,
      pinned: true,
      embeddingTarget: "creative_element_search",
      embeddingText: `${args.title}\n${args.description}\n${args.whyItWorks}\n${args.goldenRecipe}`,
      tags: [...new Set((args.tags ?? job.tags).map((tag) => clean(tag, 120)).filter(Boolean))],
      projectId: job.projectId,
      taskId: job.taskId,
      createdAtMs: now,
    });
  },
});

function clean(value: string, max: number): string {
  return value.trim().replace(/\s+/g, " ").slice(0, max);
}
