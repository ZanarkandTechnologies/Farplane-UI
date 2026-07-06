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
  mergeTags,
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
  listCreativeElementsByAssetArgsValidator,
  listCreativeElementsByJobArgsValidator,
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
