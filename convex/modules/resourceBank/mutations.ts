/**
 * RESOURCE BANK MUTATIONS
 * =======================
 * Ownership: Resource Bank Convex module.
 * Inputs: explicit operator ingestion jobs and `$ingest-content` analysis packets.
 * Outputs: saved assets, analyses, skill findings, and job/task links.
 * Side effects: writes Resource Bank tables only.
 */

import { v } from "convex/values";
import { mutation } from "../../_generated/server";
import {
  buildAnalysisEmbeddingText,
  buildAssetSearchableText,
  buildSkillFindingEmbeddingText,
  cleanText,
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
} from "./records";
import {
  addResourceAnalysisArgsValidator,
  addResourceAssetArgsValidator,
  addSkillFindingArgsValidator,
  completeIngestionJobArgsValidator,
  createIngestionJobArgsValidator,
  linkJobToTaskArgsValidator,
} from "./validators";

export const createIngestionJob = mutation({
  args: createIngestionJobArgsValidator,
  returns: v.id("resourceBankIngestionJobs"),
  handler: async (ctx, args) => {
    const timestamp = nowMs();
    const sourceRef = cleanText(args.sourceRef, 2_000);
    if (!sourceRef) throw new Error("missing_source_ref");
    return await ctx.db.insert("resourceBankIngestionJobs", {
      sourceKind: args.sourceKind,
      sourceRef,
      originalInstruction: cleanText(args.originalInstruction, 2_000),
      note: cleanText(args.note, 2_000),
      requestedFocus: cleanText(args.requestedFocus, 500),
      sourceScope: args.sourceScope,
      tags: normalizeTags(args.tags),
      projectId: cleanText(args.projectId, 120),
      taskId: cleanText(args.taskId, 120),
      externalTaskRef: cleanText(args.externalTaskRef, 500),
      requestedBy: cleanText(args.requestedBy, 120),
      status: "queued",
      sourcePrivacy: args.sourcePrivacy ?? "unknown",
      createdAtMs: timestamp,
      updatedAtMs: timestamp,
    });
  },
});

export const addResourceAsset = mutation({
  args: addResourceAssetArgsValidator,
  returns: v.id("resourceBankAssets"),
  handler: async (ctx, args) => {
    const job = await getJobOrThrow(ctx, args.jobId);
    const timestamp = nowMs();
    const tags = mergeTags(job.tags, args.tags);
    const title = cleanText(args.title, 240) ?? "Untitled resource";
    return await ctx.db.insert("resourceBankAssets", {
      ingestionJobId: args.jobId,
      parentAssetId: args.parentAssetId,
      assetRole: args.assetRole,
      assetKind: args.assetKind,
      title,
      sourceUrl: cleanText(args.sourceUrl, 2_000),
      canonicalUrl: cleanText(args.canonicalUrl, 2_000),
      storageId: cleanText(args.storageId, 240),
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
      tags,
      searchableText:
        cleanText(args.searchableText, 6_000) ??
        buildAssetSearchableText({
          title,
          note: job.note,
          requestedFocus: job.requestedFocus,
          sourceRef: job.sourceRef,
          tags,
        }),
      projectId: rowProjectId(job),
      taskId: rowTaskId(job),
      retentionNote: cleanText(args.retentionNote, 1_000),
      createdAtMs: timestamp,
      updatedAtMs: timestamp,
    });
  },
});

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

export const completeIngestionJob = mutation({
  args: completeIngestionJobArgsValidator,
  returns: v.object({ ok: v.boolean(), jobId: v.id("resourceBankIngestionJobs") }),
  handler: async (ctx, args) => {
    await getJobOrThrow(ctx, args.jobId);
    const timestamp = nowMs();
    await ctx.db.patch(args.jobId, {
      status: args.status ?? "ready",
      error: cleanText(args.error, 2_000),
      updatedAtMs: timestamp,
      completedAtMs: args.status === "failed" ? undefined : timestamp,
    });
    return { ok: true, jobId: args.jobId };
  },
});

export const linkJobToTask = mutation({
  args: linkJobToTaskArgsValidator,
  returns: v.object({ ok: v.boolean(), jobId: v.id("resourceBankIngestionJobs") }),
  handler: async (ctx, args) => {
    await getJobOrThrow(ctx, args.jobId);
    const projectId = cleanText(args.projectId, 120);
    const taskId = cleanText(args.taskId, 120);
    await ctx.db.patch(args.jobId, {
      projectId,
      taskId,
      externalTaskRef: cleanText(args.externalTaskRef, 500),
      updatedAtMs: nowMs(),
    });
    const assets = await ctx.db
      .query("resourceBankAssets")
      .withIndex("by_job", (q) => q.eq("ingestionJobId", args.jobId))
      .take(100);
    for (const asset of assets) {
      await ctx.db.patch(asset._id, { projectId, taskId, updatedAtMs: nowMs() });
    }
    return { ok: true, jobId: args.jobId };
  },
});
