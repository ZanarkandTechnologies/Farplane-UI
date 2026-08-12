/**
 * RESOURCE BANK ASSET FUNCTIONS
 * ============================
 * Ownership: Resource Bank Convex module.
 * Inputs: retained source media references, gallery filters, and optional query embeddings.
 * Outputs: asset rows, asset detail packets, and vector-similar analysis ids.
 * Side effects: writes `resourceBankAssets`; vector search reads indexed analysis embeddings.
 */

import { v } from "convex/values";
import { action, mutation, query } from "../../_generated/server";
import {
  getAssetOrThrow,
  getJobOrThrow,
  isCuratedResourceAsset,
  matchesFilters,
  nowMs,
  rowProjectId,
  rowTaskId,
  toAssetRow,
} from "./records";
import {
  buildAssetSearchableText,
  clampLimit,
  cleanText,
  mergeTags,
  normalizeFacetValues,
} from "./resourceBank";
import {
  addResourceAssetArgsValidator,
  findSimilarAssetsArgsValidator,
  getResourceAssetArgsValidator,
  searchGalleryArgsValidator,
} from "./validators";

export const addResourceAsset = mutation({
  args: addResourceAssetArgsValidator,
  returns: v.id("resourceBankAssets"),
  handler: async (ctx, args) => {
    const job = await getJobOrThrow(ctx, args.jobId);
    const timestamp = nowMs();
    const tags = mergeTags(job.tags, args.tags);
    const outputTypes = normalizeFacetValues(args.outputTypes);
    const audiences = normalizeFacetValues(args.audiences);
    const ageRanges = normalizeFacetValues(args.ageRanges);
    const industries = normalizeFacetValues(args.industries);
    const customerRoles = normalizeFacetValues(args.customerRoles);
    const title = cleanText(args.title, 240) ?? "Untitled resource";
    return await ctx.db.insert("resourceBankAssets", {
      ingestionJobId: args.jobId,
      parentAssetId: args.parentAssetId,
      assetRole: args.assetRole,
      assetKind: args.assetKind,
      title,
      sourceUrl: cleanText(args.sourceUrl, 2_000),
      canonicalUrl: cleanText(args.canonicalUrl, 2_000),
      storageId: args.storageId,
      localPath: cleanText(args.localPath, 2_000),
      mimeType: cleanText(args.mimeType, 120),
      width: args.width,
      height: args.height,
      durationMs: args.durationMs,
      startMs: args.startMs ?? job.sourceScope?.startMs,
      endMs: args.endMs ?? job.sourceScope?.endMs,
      platform: cleanText(args.platform, 120),
      author: cleanText(args.author, 240),
      attributionStatus: args.attributionStatus ?? "unknown",
      outputTypes,
      audiences,
      ageRanges,
      industries,
      customerRoles,
      tastinessScore: args.tastinessScore,
      tags,
      searchableText:
        cleanText(args.searchableText, 6_000) ??
        buildAssetSearchableText({
          title,
          note: job.note,
          requestedFocus: job.requestedFocus,
          sourceRef: job.sourceRef,
          tags: mergeTags(tags, outputTypes, audiences, ageRanges, industries, customerRoles),
        }),
      projectId: rowProjectId(job),
      taskId: rowTaskId(job),
      retentionNote: cleanText(args.retentionNote, 1_000),
      createdAtMs: timestamp,
      updatedAtMs: timestamp,
    });
  },
});

export const generateResourceAssetUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const searchGallery = query({
  args: searchGalleryArgsValidator,
  handler: async (ctx, args) => {
    const limit = clampLimit(args.limit, 24);
    const queryText = cleanText(args.query, 500);
    const rows = queryText
      ? await ctx.db
          .query("resourceBankAssets")
          .withSearchIndex("search_assets", (q) =>
            args.assetKind
              ? q.search("searchableText", queryText).eq("assetKind", args.assetKind)
              : q.search("searchableText", queryText),
          )
          .take(limit * 3)
      : args.projectId
        ? await ctx.db
            .query("resourceBankAssets")
            .withIndex("by_project_createdAtMs", (q) => q.eq("projectId", args.projectId))
            .order("desc")
            .take(limit * 3)
        : await ctx.db
            .query("resourceBankAssets")
            .withIndex("by_createdAtMs")
            .order("desc")
            .take(limit * 3);
    const curatedRows = await Promise.all(
      rows.map(async (row) => ((await isCuratedResourceAsset(ctx, row)) ? row : null)),
    );
    return curatedRows
      .filter((row): row is (typeof rows)[number] => row !== null && matchesFilters(row, args))
      .slice(0, limit)
      .map(toAssetRow);
  },
});

export const getResourceAsset = query({
  args: getResourceAssetArgsValidator,
  handler: async (ctx, args) => {
    const asset = await getAssetOrThrow(ctx, args.assetId);
    const [analyses, derivedAssets, skillFindings] = await Promise.all([
      ctx.db
        .query("resourceBankAnalyses")
        .withIndex("by_asset", (q) => q.eq("assetId", args.assetId))
        .collect(),
      ctx.db
        .query("resourceBankAssets")
        .withIndex("by_job", (q) => q.eq("ingestionJobId", asset.ingestionJobId))
        .collect(),
      ctx.db
        .query("resourceBankSkillFindings")
        .withIndex("by_asset", (q) => q.eq("assetId", args.assetId))
        .collect(),
    ]);
    return {
      ...asset,
      analyses,
      derivedAssets: derivedAssets.filter((candidate) => candidate.parentAssetId === args.assetId),
      skillFindings,
    };
  },
});

export const findSimilarAssets = action({
  args: findSimilarAssetsArgsValidator,
  returns: v.object({
    results: v.array(
      v.object({
        analysisId: v.id("resourceBankAnalyses"),
        score: v.number(),
      }),
    ),
    note: v.string(),
  }),
  handler: async (ctx, args) => {
    const limit = clampLimit(args.limit, 12, 40);
    const results = await ctx.vectorSearch("resourceBankAnalyses", "by_embedding", {
      vector: args.embedding,
      limit,
      filter: args.projectId
        ? (q) => q.eq("projectId", args.projectId)
        : args.taskId
          ? (q) => q.eq("taskId", args.taskId)
          : undefined,
    });
    return {
      results: results.map((result) => ({
        analysisId: result._id,
        score: result._score,
      })),
      note: "Vector search returns analysis ids and scores; load asset details with getResourceAsset after resolving the analysis rows.",
    };
  },
});
