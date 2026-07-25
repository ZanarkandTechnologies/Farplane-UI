// Resource Bank retrieval functions compose asset, analysis, and skill-finding rows for UI and agents.
import type { Id } from "../../_generated/dataModel";
import type { QueryCtx } from "../../_generated/server";
import { query } from "../../_generated/server";
import {
  matchesFilters,
  toAnalysisRow,
  toAssetRow,
  toCreativeElementRow,
  toSkillFindingRow,
} from "./records";
import {
  buildResourceBankDashboard,
  buildRetrievalTagPlan,
  buildTastyPack,
  clampLimit,
  cleanText,
  matchesTastyPackFilters,
  RESOURCE_BANK_QUERY_LIMIT,
  type ResourceBankAssetRow,
  resolveTastyPackFilters,
} from "./resourceBank";
import {
  createTastyPackArgsValidator,
  dashboardArgsValidator,
  retrieveForCreationArgsValidator,
} from "./validators";

export const getResourceBankDashboard = query({
  args: dashboardArgsValidator,
  handler: async (ctx, args) => {
    const limit = clampLimit(args.limit, 24, RESOURCE_BANK_QUERY_LIMIT);
    const assets = await ctx.db
      .query("resourceBankAssets")
      .withIndex("by_createdAtMs")
      .order("desc")
      .take(limit * 3);
    const filteredAssets = assets
      .filter((row) => row.assetRole === "primary" && matchesFilters(row, args))
      .slice(0, limit);
    const derivedAssets = await Promise.all(
      filteredAssets.map((asset) =>
        ctx.db
          .query("resourceBankAssets")
          .withIndex("by_job", (q) => q.eq("ingestionJobId", asset.ingestionJobId))
          .take(20),
      ),
    );
    const selectedAssets = [
      ...filteredAssets,
      ...derivedAssets
        .flat()
        .filter(
          (asset) =>
            asset.assetRole !== "primary" &&
            filteredAssets.some((primary) => primary._id === asset.parentAssetId),
        ),
    ];
    const analyses = await Promise.all(
      filteredAssets.map((asset) =>
        ctx.db
          .query("resourceBankAnalyses")
          .withIndex("by_asset", (q) => q.eq("assetId", asset._id))
          .take(10),
      ),
    );
    const creativeElements = await Promise.all(
      filteredAssets.map((asset) =>
        ctx.db
          .query("resourceBankCreativeElements")
          .withIndex("by_asset", (q) => q.eq("assetId", asset._id))
          .take(20),
      ),
    );
    const findings = await Promise.all(
      filteredAssets.map((asset) =>
        ctx.db
          .query("resourceBankSkillFindings")
          .withIndex("by_asset", (q) => q.eq("assetId", asset._id))
          .take(10),
      ),
    );
    const selectedAssetRows = await hydrateStorageUrls(ctx, selectedAssets.map(toAssetRow));
    return buildResourceBankDashboard(
      selectedAssetRows,
      analyses.flat().map(toAnalysisRow),
      creativeElements.flat().map(toCreativeElementRow),
      findings.flat().map(toSkillFindingRow),
    );
  },
});

async function hydrateStorageUrls(
  ctx: QueryCtx,
  assets: ResourceBankAssetRow[],
): Promise<ResourceBankAssetRow[]> {
  return await Promise.all(
    assets.map(async (asset) => ({
      ...asset,
      storageUrl: asset.storageId
        ? await ctx.storage.getUrl(asset.storageId as Id<"_storage">)
        : undefined,
    })),
  );
}

export const retrieveForCreation = query({
  args: retrieveForCreationArgsValidator,
  handler: async (ctx, args) => {
    const count = clampLimit(args.count, 5, 12);
    const tagPlan = buildRetrievalTagPlan(args);
    const queryText = cleanText(args.goal, 500) ?? "";
    const assets = await ctx.db
      .query("resourceBankAssets")
      .withSearchIndex("search_assets", (q) => q.search("searchableText", queryText))
      .take(count * 4);
    const filteredAssets = assets
      .filter((row) => matchesFilters(row, { ...args, tags: tagPlan.filterTags }))
      .slice(0, count);
    const packets = [];
    for (const asset of filteredAssets) {
      const [analyses, findings] = await Promise.all([
        ctx.db
          .query("resourceBankAnalyses")
          .withIndex("by_asset", (q) => q.eq("assetId", asset._id))
          .take(4),
        ctx.db
          .query("resourceBankSkillFindings")
          .withIndex("by_asset", (q) => q.eq("assetId", asset._id))
          .take(8),
      ]);
      packets.push({
        assetId: asset._id,
        title: asset.title,
        why_relevant: analyses[0]?.analysisMarkdown,
        skill_findings: findings.map(toSkillFindingRow),
        source_analysis: analyses.map(toAnalysisRow),
        transcript: analyses.find((analysis) => analysis.transcriptText)?.transcriptText,
        attribution: {
          author: asset.author,
          status: asset.attributionStatus,
          sourceUrl: asset.sourceUrl,
          canonicalUrl: asset.canonicalUrl,
        },
        source_handle: asset.storageId ?? asset.canonicalUrl ?? asset.sourceUrl ?? asset.localPath,
      });
    }
    return {
      query: args.goal,
      top_matches: packets,
      tag_expansions: tagPlan.tagExpansions,
      retrieval_notes:
        args.embedding == null
          ? [
              "Used full-text/tag retrieval. Pass an embedding to a vector-search action for semantic nearest-neighbor search.",
              ...(args.outputType
                ? [`Treated outputType "${args.outputType}" as a soft hint, not a required tag.`]
                : []),
            ]
          : [
              "Embedding was supplied but this query path is full-text; use findSimilarAssets for vector search.",
            ],
    };
  },
});

export const createTastyPack = query({
  args: createTastyPackArgsValidator,
  handler: async (ctx, args) => {
    const limit = clampLimit(args.limit, 5, 20);
    const queryText = cleanText(args.idea, 500);
    const filters = resolveTastyPackFilters(args, Date.now());
    const rawAssets = queryText
      ? await ctx.db
          .query("resourceBankAssets")
          .withSearchIndex("search_assets", (q) => q.search("searchableText", queryText))
          .take(limit * 8)
      : await ctx.db
          .query("resourceBankAssets")
          .withIndex("by_createdAtMs")
          .order("desc")
          .take(limit * 8);

    const assets = rawAssets
      .map(toAssetRow)
      .filter((asset) => matchesTastyPackFilters(asset, filters));
    const selectedAssets = assets
      .sort(
        (left, right) =>
          (right.tastinessScore ?? 0) - (left.tastinessScore ?? 0) ||
          right.createdAtMs - left.createdAtMs,
      )
      .slice(0, limit);
    const [jobs, analyses, creativeElements] = await Promise.all([
      Promise.all(
        selectedAssets.map((asset) =>
          asset.ingestionJobId
            ? ctx.db.get(asset.ingestionJobId as Id<"resourceBankIngestionJobs">)
            : null,
        ),
      ),
      Promise.all(
        selectedAssets.map((asset) =>
          asset._id
            ? ctx.db
                .query("resourceBankAnalyses")
                .withIndex("by_asset", (q) => q.eq("assetId", asset._id))
                .take(6)
            : [],
        ),
      ),
      Promise.all(
        selectedAssets.map((asset) =>
          asset._id
            ? ctx.db
                .query("resourceBankCreativeElements")
                .withIndex("by_asset", (q) => q.eq("assetId", asset._id))
                .take(80)
            : [],
        ),
      ),
    ]);
    const kindFilters = new Set(args.kinds ?? []);
    const filteredCreativeElements = creativeElements.flat().map(toCreativeElementRow);
    const selectedAssetsWithNotes = selectedAssets.map((asset, index) => ({
      ...asset,
      operatorNote: cleanText(jobs[index]?.note, 2_000),
    }));

    return buildTastyPack({
      idea: args.idea,
      filters,
      assets: selectedAssetsWithNotes,
      analyses: analyses.flat().map(toAnalysisRow),
      creativeElements: filteredCreativeElements.filter(
        (row) => kindFilters.size === 0 || kindFilters.has(row.kind),
      ),
    });
  },
});
