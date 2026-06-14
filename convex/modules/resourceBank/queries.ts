// Resource Bank read APIs for gallery search, asset detail, dashboard clusters, and creation retrieval.
import { query } from "../../_generated/server";
import {
  buildResourceBankDashboard,
  clampLimit,
  cleanText,
  mergeTags,
  RESOURCE_BANK_QUERY_LIMIT,
} from "./resourceBank";
import { matchesFilters, toAnalysisRow, toAssetRow, toSkillFindingRow } from "./records";
import {
  dashboardArgsValidator,
  getResourceAssetArgsValidator,
  retrieveForCreationArgsValidator,
  searchGalleryArgsValidator,
  searchSkillFindingsArgsValidator,
} from "./validators";

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
    return rows
      .filter((row) => matchesFilters(row, args))
      .slice(0, limit)
      .map(toAssetRow);
  },
});

export const searchSkillFindings = query({
  args: searchSkillFindingsArgsValidator,
  handler: async (ctx, args) => {
    const limit = clampLimit(args.limit, 24);
    const queryText = cleanText(args.query, 500);
    const rows = queryText
      ? await ctx.db
          .query("resourceBankSkillFindings")
          .withSearchIndex("search_skill_findings", (q) =>
            args.findingKind
              ? q.search("embeddingText", queryText).eq("findingKind", args.findingKind)
              : q.search("embeddingText", queryText),
          )
          .take(limit * 3)
      : args.skillId
        ? await ctx.db
            .query("resourceBankSkillFindings")
            .withIndex("by_skillId_createdAtMs", (q) => q.eq("skillId", args.skillId))
            .order("desc")
            .take(limit * 3)
        : await ctx.db
            .query("resourceBankSkillFindings")
            .withIndex("by_project_createdAtMs", (q) => q.eq("projectId", args.projectId))
            .order("desc")
            .take(limit * 3);
    return rows
      .filter((row) => matchesFilters(row, args))
      .slice(0, limit)
      .map(toSkillFindingRow);
  },
});

export const getResourceAsset = query({
  args: getResourceAssetArgsValidator,
  handler: async (ctx, args) => {
    const asset = await ctx.db.get(args.assetId);
    if (!asset) return null;
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

export const getResourceBankDashboard = query({
  args: dashboardArgsValidator,
  handler: async (ctx, args) => {
    const limit = clampLimit(args.limit, 24, RESOURCE_BANK_QUERY_LIMIT);
    const assets = await ctx.db
      .query("resourceBankAssets")
      .withIndex("by_createdAtMs")
      .order("desc")
      .take(limit * 3);
    const filteredAssets = assets.filter((row) => matchesFilters(row, args)).slice(0, limit);
    const analyses = await Promise.all(
      filteredAssets.map((asset) =>
        ctx.db
          .query("resourceBankAnalyses")
          .withIndex("by_asset", (q) => q.eq("assetId", asset._id))
          .take(10),
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
    return buildResourceBankDashboard(
      filteredAssets.map(toAssetRow),
      analyses.flat().map(toAnalysisRow),
      findings.flat().map(toSkillFindingRow),
    );
  },
});

export const retrieveForCreation = query({
  args: retrieveForCreationArgsValidator,
  handler: async (ctx, args) => {
    const count = clampLimit(args.count, 5, 12);
    const tags = mergeTags(args.tags, args.outputType ? [`output:${args.outputType}`] : undefined);
    const queryText = cleanText(args.goal, 500) ?? "";
    const assets = await ctx.db
      .query("resourceBankAssets")
      .withSearchIndex("search_assets", (q) => q.search("searchableText", queryText))
      .take(count * 4);
    const filteredAssets = assets
      .filter((row) => matchesFilters(row, { ...args, tags }))
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
        why_relevant: analyses[0]?.whyItWorks ?? [],
        skill_findings: findings.map(toSkillFindingRow),
        source_analysis: analyses.map(toAnalysisRow),
        prompt_guess: analyses.find((analysis) => analysis.promptGuess)?.promptGuess,
        remix_constraints: analyses.flatMap((analysis) => analysis.remixConstraints),
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
      tag_expansions: tags,
      retrieval_notes:
        args.embedding == null
          ? ["Used full-text/tag retrieval. Pass an embedding to a vector-search action for semantic nearest-neighbor search."]
          : ["Embedding was supplied but this query path is full-text; use findSimilarAssets for vector search."],
    };
  },
});
