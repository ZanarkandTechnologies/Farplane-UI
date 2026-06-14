// Resource Bank retrieval functions compose asset, analysis, and skill-finding rows for UI and agents.
import { query } from "../../_generated/server";
import {
  buildResourceBankDashboard,
  clampLimit,
  cleanText,
  mergeTags,
  RESOURCE_BANK_QUERY_LIMIT,
} from "./resourceBank";
import { matchesFilters, toAnalysisRow, toAssetRow, toSkillFindingRow } from "./records";
import { dashboardArgsValidator, retrieveForCreationArgsValidator } from "./validators";

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
