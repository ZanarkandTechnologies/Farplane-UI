// Resource Bank skill-finding actions own extracted reusable capabilities and skill candidates.
import { v } from "convex/values";
import { mutation, query } from "../../../_generated/server";
import { buildSkillFindingEmbeddingText, clampLimit, cleanText, mergeTags } from "../resourceBank";
import {
  getAnalysisOrThrow,
  getAssetOrThrow,
  getJobOrThrow,
  matchesFilters,
  nowMs,
  rowProjectId,
  rowTaskId,
  toSkillFindingRow,
} from "../shared/records";
import { addSkillFindingArgsValidator, searchSkillFindingsArgsValidator } from "../validators";

export const addSkillFinding = mutation({
  args: addSkillFindingArgsValidator,
  returns: v.id("resourceBankSkillFindings"),
  handler: async (ctx, args) => {
    const job = await getJobOrThrow(ctx, args.jobId);
    const asset = await getAssetOrThrow(ctx, args.assetId);
    const analysis = await getAnalysisOrThrow(ctx, args.analysisId);
    if (asset.ingestionJobId !== args.jobId || analysis.assetId !== args.assetId) {
      throw new Error("resource_bank_skill_finding_parent_mismatch");
    }
    const tags = mergeTags(job.tags, asset.tags, args.tags);
    const label = cleanText(args.label, 240) ?? "Untitled skill finding";
    const embeddingText =
      cleanText(args.embeddingText, 6_000) ??
      buildSkillFindingEmbeddingText({
        label,
        capability: args.capability,
        evidenceAnchor: args.evidenceAnchor,
        howToReuse: args.howToReuse,
        suggestedSkillChange: args.suggestedSkillChange,
        tags,
      });
    return await ctx.db.insert("resourceBankSkillFindings", {
      ingestionJobId: args.jobId,
      assetId: args.assetId,
      analysisId: args.analysisId,
      findingKind: args.findingKind,
      skillId: cleanText(args.skillId, 120),
      skillPath: cleanText(args.skillPath, 2_000),
      label,
      capability: cleanText(args.capability, 1_000) ?? "",
      evidenceAnchor: cleanText(args.evidenceAnchor, 1_000) ?? "",
      howToReuse: cleanText(args.howToReuse, 2_000) ?? "",
      suggestedSkillChange: cleanText(args.suggestedSkillChange, 2_000),
      tags,
      confidence: args.confidence ?? "medium",
      embeddingTarget: "skill_finding_search",
      embeddingText,
      embeddingModel: cleanText(args.embeddingModel, 120),
      embedding: args.embedding,
      projectId: rowProjectId(job, asset.projectId),
      taskId: rowTaskId(job, asset.taskId),
      createdAtMs: nowMs(),
    });
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
