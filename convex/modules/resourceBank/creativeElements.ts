/**
 * RESOURCE BANK CREATIVE ELEMENT FUNCTIONS
 * =======================================
 * Ownership: Resource Bank Convex module.
 * Inputs: reusable production components extracted from saved inspiration.
 * Outputs: creative element rows for Inspiration Pack v2 retrieval.
 * Side effects: writes `resourceBankCreativeElements`.
 */

import { v } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import type { QueryCtx } from "../../_generated/server";
import { mutation, query } from "../../_generated/server";
import {
  getAnalysisOrThrow,
  getAssetOrThrow,
  getJobOrThrow,
  nowMs,
  rowProjectId,
  rowTaskId,
  toAssetRow,
  toCreativeElementRow,
} from "./records";
import {
  buildCreativeElementEmbeddingText,
  clampLimit,
  cleanText,
  includesAllTags,
  mergeTags,
  normalizeTags,
  requireCleanText,
  selectPreviewAsset,
} from "./resourceBank";
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
    const goldenExampleAsset = await getAssetOrThrow(ctx, args.goldenExample.assetId);
    if (goldenExampleAsset.ingestionJobId !== args.jobId) {
      throw new Error("resource_bank_golden_example_asset_job_mismatch");
    }
    if (args.analysisId) {
      const analysis = await getAnalysisOrThrow(ctx, args.analysisId);
      if (analysis.assetId !== args.assetId || analysis.ingestionJobId !== args.jobId) {
        throw new Error("resource_bank_analysis_asset_mismatch");
      }
    }
    const title = cleanText(args.title, 240) ?? "Untitled creative element";
    const description = requireCleanText(args.description, "resource_bank_description", 2_000);
    const whyItWorks = requireCleanText(args.whyItWorks, "resource_bank_why_it_works", 2_000);
    const goldenRecipe = requireCleanText(
      args.goldenRecipe,
      "resource_bank_golden_recipe",
      6_000,
    );
    const goldenExample = {
      assetId: args.goldenExample.assetId,
      description: cleanText(args.goldenExample.description, 1_000),
    };
    const tags = mergeTags(job.tags, asset.tags, args.tags);
    const embeddingText =
      cleanText(args.embeddingText, 6_000) ??
      buildCreativeElementEmbeddingText({
        title,
        description,
        whyItWorks,
        goldenExampleDescription: goldenExample.description,
        goldenRecipe,
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
      whyItWorks,
      goldenExample,
      goldenRecipe,
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
    const jobIds = [...new Set(assets.flatMap((asset) => (asset ? [asset.ingestionJobId] : [])))];
    const jobAssets = (
      await Promise.all(
        jobIds.map((jobId) =>
          ctx.db
            .query("resourceBankAssets")
            .withIndex("by_job", (q) => q.eq("ingestionJobId", jobId))
            .collect(),
        ),
      )
    )
      .flat()
      .map(toAssetRow);
    return await Promise.all(
      filteredRows.map(async (row, index) => {
        const asset = assets[index];
        const assetRow = asset ? toAssetRow(asset) : undefined;
        const previewAsset = assetRow
          ? selectPreviewAsset(
              assetRow,
              jobAssets.filter((candidate) => candidate.parentAssetId === assetRow._id),
            )
          : undefined;
        return {
          ...toCreativeElementRow(row),
          assetTitle: asset?.title,
          assetKind: asset?.assetKind,
          assetSourceUrl: asset?.sourceUrl,
          assetCanonicalUrl: asset?.canonicalUrl,
          goldenExampleAsset: await hydrateElementGoldenExampleAsset(ctx, row),
          previewAsset: previewAsset
            ? {
                ...previewAsset,
                storageUrl: previewAsset.storageId
                  ? await ctx.storage.getUrl(previewAsset.storageId)
                  : null,
              }
            : undefined,
        };
      }),
    );
  },
});

export const updateCreativeElement = mutation({
  args: updateCreativeElementArgsValidator,
  returns: v.object({
    _id: v.id("resourceBankCreativeElements"),
    kind: v.string(),
    title: v.string(),
    description: v.string(),
    whyItWorks: v.string(),
    goldenExample: v.object({
      assetId: v.id("resourceBankAssets"),
      description: v.optional(v.string()),
    }),
    goldenRecipe: v.string(),
    anchor: v.optional(v.string()),
    pinned: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.elementId);
    if (!row) throw new Error("resource_bank_creative_element_not_found");
    const title = cleanText(args.title, 240) ?? row.title;
    const description = requireCleanText(
      args.description === undefined ? row.description : args.description,
      "resource_bank_description",
      2_000,
    );
    const whyItWorks = requireCleanText(
      args.whyItWorks === undefined ? row.whyItWorks : args.whyItWorks,
      "resource_bank_why_it_works",
      2_000,
    );
    const goldenRecipe = requireCleanText(
      args.goldenRecipe === undefined ? row.goldenRecipe : args.goldenRecipe,
      "resource_bank_golden_recipe",
      6_000,
    );
    const goldenExample =
      args.goldenExample === undefined
        ? row.goldenExample
        : {
            assetId: args.goldenExample.assetId,
            description: cleanText(args.goldenExample.description, 1_000),
          };
    const goldenExampleAsset = await getAssetOrThrow(ctx, goldenExample.assetId);
    if (goldenExampleAsset.ingestionJobId !== row.ingestionJobId) {
      throw new Error("resource_bank_golden_example_asset_job_mismatch");
    }
    const anchor = args.anchor === undefined ? row.anchor : cleanText(args.anchor, 500);
    const tags = args.tags === undefined ? row.tags : mergeTags(args.tags);
    const embeddingText = buildCreativeElementEmbeddingText({
      title,
      description,
      whyItWorks,
      goldenExampleDescription: goldenExample.description,
      goldenRecipe,
      anchor,
      tags,
    });
    await ctx.db.patch(args.elementId, {
      kind: args.kind ?? row.kind,
      title,
      description,
      whyItWorks,
      goldenExample,
      goldenRecipe,
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
      whyItWorks: updated.whyItWorks,
      goldenExample: updated.goldenExample,
      goldenRecipe: updated.goldenRecipe,
      anchor: updated.anchor,
      pinned: updated.pinned ?? false,
    };
  },
});

async function hydrateElementGoldenExampleAsset(
  ctx: QueryCtx,
  row: { goldenExample: { assetId: Id<"resourceBankAssets">; description?: string } },
) {
  const assetId = row.goldenExample.assetId;
  const asset = await ctx.db.get(assetId);
  if (!asset) return undefined;
  return {
    ...toAssetRow(asset),
    storageUrl: asset.storageId ? await ctx.storage.getUrl(asset.storageId) : null,
  };
}

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
