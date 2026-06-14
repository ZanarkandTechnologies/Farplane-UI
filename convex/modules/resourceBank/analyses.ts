// Resource Bank analysis functions own source breakdown records for retained assets.
import { v } from "convex/values";
import { mutation } from "../../_generated/server";
import { buildAnalysisEmbeddingText, cleanText, mergeTags } from "./resourceBank";
import { getAssetOrThrow, getJobOrThrow, nowMs, rowProjectId, rowTaskId } from "./records";
import { addResourceAnalysisArgsValidator } from "./validators";

export const addResourceAnalysis = mutation({
  args: addResourceAnalysisArgsValidator,
  returns: v.id("resourceBankAnalyses"),
  handler: async (ctx, args) => {
    const job = await getJobOrThrow(ctx, args.jobId);
    const asset = await getAssetOrThrow(ctx, args.assetId);
    if (asset.ingestionJobId !== args.jobId) throw new Error("resource_bank_asset_job_mismatch");
    const facts = args.facts ?? [];
    const interpretation = args.interpretation ?? [];
    const whyItWorks = args.whyItWorks ?? [];
    const takeaways = args.takeaways ?? [];
    const remixConstraints = args.remixConstraints ?? [];
    const tags = mergeTags(job.tags, asset.tags, args.tags);
    const embeddingText =
      cleanText(args.embeddingText, 6_000) ??
      buildAnalysisEmbeddingText({
        facts,
        frameNotes: args.frameNotes,
        interpretation,
        promptGuess: args.promptGuess,
        remixConstraints,
        takeaways,
        transcriptText: args.transcriptText,
        userIntent: args.userIntent ?? job.note,
        whyItWorks,
      });
    return await ctx.db.insert("resourceBankAnalyses", {
      ingestionJobId: args.jobId,
      assetId: args.assetId,
      analysisType: args.analysisType,
      sourceSkill: cleanText(args.sourceSkill, 120) ?? "ingest-content",
      facts,
      interpretation,
      userIntent: cleanText(args.userIntent ?? job.note, 2_000),
      whyItWorks,
      takeaways,
      transcriptText: cleanText(args.transcriptText, 6_000),
      frameNotes: cleanText(args.frameNotes, 2_000),
      promptGuess: cleanText(args.promptGuess, 2_000),
      remixConstraints,
      confidence: args.confidence ?? "medium",
      embeddingTarget: "analysis_search",
      embeddingText,
      embeddingModel: cleanText(args.embeddingModel, 120),
      embedding: args.embedding,
      projectId: rowProjectId(job, asset.projectId),
      taskId: rowTaskId(job, asset.taskId),
      tags,
      createdAtMs: nowMs(),
    });
  },
});
