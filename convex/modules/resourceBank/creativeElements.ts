/**
 * RESOURCE BANK CREATIVE ELEMENT FUNCTIONS
 * =======================================
 * Ownership: Resource Bank Convex module.
 * Inputs: reusable production components extracted from saved inspiration.
 * Outputs: creative element rows for Inspiration Pack v2 retrieval.
 * Side effects: writes `resourceBankCreativeElements`.
 */

import { v } from "convex/values";
import { mutation, query } from "../../_generated/server";
import {
  buildCreativeElementEmbeddingText,
  clampLimit,
  cleanText,
  includesAllTags,
  mergeTags,
  normalizeTags,
} from "./resourceBank";
import {
  getAnalysisOrThrow,
  getAssetOrThrow,
  getJobOrThrow,
  nowMs,
  rowProjectId,
  rowTaskId,
  toCreativeElementRow,
} from "./records";
import {
  addCreativeElementArgsValidator,
  listCreativeElementsArgsValidator,
  listCreativeElementsByAssetArgsValidator,
  listCreativeElementsByJobArgsValidator,
  updateCreativeElementArgsValidator,
} from "./validators";

export const addCreativeElement = mutation({
  args: addCreativeElementArgsValidator,
  returns: v.id("resourceBankCreativeElements"),
  handler: async (ctx, args) => {
    const job = await getJobOrThrow(ctx, args.jobId);
    const asset = await getAssetOrThrow(ctx, args.assetId);
    if (asset.ingestionJobId !== args.jobId) throw new Error("resource_bank_asset_job_mismatch");
    if (args.analysisId) {
      const analysis = await getAnalysisOrThrow(ctx, args.analysisId);
      if (analysis.assetId !== args.assetId || analysis.ingestionJobId !== args.jobId) {
        throw new Error("resource_bank_analysis_asset_mismatch");
      }
    }
    const title = cleanText(args.title, 240) ?? "Untitled creative element";
    const description = cleanText(args.description, 2_000) ?? title;
    const tags = mergeTags(job.tags, asset.tags, args.tags);
    const embeddingText =
      cleanText(args.embeddingText, 6_000) ??
      buildCreativeElementEmbeddingText({
        title,
        description,
        anchor: args.anchor,
        tags,
      });

    return await ctx.db.insert("resourceBankCreativeElements", {
      ingestionJobId: args.jobId,
      assetId: args.assetId,
      analysisId: args.analysisId,
      kind: args.kind,
      title,
      description,
      anchor: cleanText(args.anchor, 500),
      pinned: args.pinned ?? false,
      embeddingTarget: "creative_element_search",
      embeddingText,
      embedding: args.embedding,
      tags,
      projectId: rowProjectId(job, asset.projectId),
      taskId: rowTaskId(job, asset.taskId),
      createdAtMs: nowMs(),
    });
  },
});

export const listCreativeElementsByAsset = query({
  args: listCreativeElementsByAssetArgsValidator,
  handler: async (ctx, args) => {
    const limit = clampLimit(args.limit, 40, 120);
    const rows = await ctx.db
      .query("resourceBankCreativeElements")
      .withIndex("by_asset", (q) => q.eq("assetId", args.assetId))
      .take(limit * 2);
    return rows
      .filter((row) => !args.kind || row.kind === args.kind)
      .slice(0, limit)
      .map(toCreativeElementRow);
  },
});

export const listCreativeElements = query({
  args: listCreativeElementsArgsValidator,
  handler: async (ctx, args) => {
    const limit = clampLimit(args.limit, 80, 200);
    const queryText = cleanText(args.query, 500);
    const kind = args.kind;
    const rows = queryText
      ? await ctx.db
          .query("resourceBankCreativeElements")
          .withSearchIndex("search_creative_elements", (q) => q.search("embeddingText", queryText))
          .take(limit * 4)
      : kind
        ? await ctx.db
            .query("resourceBankCreativeElements")
            .withIndex("by_kind_createdAtMs", (q) => q.eq("kind", kind))
            .order("desc")
            .take(limit * 4)
        : args.projectId
          ? await ctx.db
              .query("resourceBankCreativeElements")
              .withIndex("by_project_createdAtMs", (q) => q.eq("projectId", args.projectId))
              .order("desc")
              .take(limit * 4)
          : args.taskId
            ? await ctx.db
                .query("resourceBankCreativeElements")
                .withIndex("by_task_createdAtMs", (q) => q.eq("taskId", args.taskId))
                .order("desc")
                .take(limit * 4)
            : await ctx.db
                .query("resourceBankCreativeElements")
                .withIndex("by_createdAtMs")
                .order("desc")
                .take(limit * 4);
    const tags = normalizeTags(args.tags);
    const filteredRows = rows
      .filter((row) => !args.kind || row.kind === args.kind)
      .filter((row) => !args.projectId || row.projectId === args.projectId)
      .filter((row) => !args.taskId || row.taskId === args.taskId)
      .filter((row) => includesAllTags(row.tags, tags))
      .slice(0, limit);
    const assets = await Promise.all(filteredRows.map((row) => ctx.db.get(row.assetId)));
    return filteredRows.map((row, index) => {
      const asset = assets[index];
      return {
        ...toCreativeElementRow(row),
        assetTitle: asset?.title,
        assetKind: asset?.assetKind,
        assetSourceUrl: asset?.sourceUrl,
        assetCanonicalUrl: asset?.canonicalUrl,
      };
    });
  },
});

export const updateCreativeElement = mutation({
  args: updateCreativeElementArgsValidator,
  returns: v.object({
    _id: v.id("resourceBankCreativeElements"),
    kind: v.string(),
    title: v.string(),
    description: v.string(),
    anchor: v.optional(v.string()),
    pinned: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.elementId);
    if (!row) throw new Error("resource_bank_creative_element_not_found");
    const title = cleanText(args.title, 240) ?? row.title;
    const description = cleanText(args.description, 2_000) ?? row.description;
    const anchor = args.anchor === undefined ? row.anchor : cleanText(args.anchor, 500);
    const tags = args.tags === undefined ? row.tags : mergeTags(args.tags);
    const embeddingText = buildCreativeElementEmbeddingText({
      title,
      description,
      anchor,
      tags,
    });
    await ctx.db.patch(args.elementId, {
      kind: args.kind ?? row.kind,
      title,
      description,
      anchor,
      pinned: args.pinned ?? row.pinned ?? false,
      tags,
      embeddingText,
    });
    const updated = await ctx.db.get(args.elementId);
    if (!updated) throw new Error("resource_bank_creative_element_not_found_after_update");
    return {
      _id: updated._id,
      kind: updated.kind,
      title: updated.title,
      description: updated.description,
      anchor: updated.anchor,
      pinned: updated.pinned ?? false,
    };
  },
});

export const listCreativeElementsByJob = query({
  args: listCreativeElementsByJobArgsValidator,
  handler: async (ctx, args) => {
    const limit = clampLimit(args.limit, 80, 200);
    const rows = await ctx.db
      .query("resourceBankCreativeElements")
      .withIndex("by_job", (q) => q.eq("ingestionJobId", args.jobId))
      .take(limit * 2);
    return rows
      .filter((row) => !args.kind || row.kind === args.kind)
      .slice(0, limit)
      .map(toCreativeElementRow);
  },
});
