/**
 * RESOURCE BANK USE CASES
 * =======================
 * Ownership: Resource Bank Convex module.
 * Inputs: explicit operator ingestion jobs and `$ingest-content` analysis packets.
 * Outputs: saved assets, analyses, skill findings, gallery search, and retrieval packets.
 * Side effects: writes Resource Bank tables; vector search actions read indexed embeddings.
 */

import { v } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import { action, mutation, type MutationCtx, query, type QueryCtx } from "../../_generated/server";
import {
  buildAnalysisEmbeddingText,
  buildAssetSearchableText,
  buildResourceBankDashboard,
  buildSkillFindingEmbeddingText,
  clampLimit,
  cleanText,
  includesAllTags,
  mergeTags,
  normalizeTags,
  RESOURCE_BANK_QUERY_LIMIT,
} from "./resourceBank";
import {
  addResourceAnalysisArgsValidator,
  addResourceAssetArgsValidator,
  addSkillFindingArgsValidator,
  completeIngestionJobArgsValidator,
  createIngestionJobArgsValidator,
  dashboardArgsValidator,
  findSimilarAssetsArgsValidator,
  getResourceAssetArgsValidator,
  linkJobToTaskArgsValidator,
  retrieveForCreationArgsValidator,
  searchGalleryArgsValidator,
  searchSkillFindingsArgsValidator,
  seedDemoArgsValidator,
} from "./validators";

type ResourceBankDbCtx = Pick<MutationCtx | QueryCtx, "db">;
type ResourceBankJob = Doc<"resourceBankIngestionJobs">;
type ResourceBankAsset = Doc<"resourceBankAssets">;
type ResourceBankAnalysis = Doc<"resourceBankAnalyses">;
type ResourceBankSkillFinding = Doc<"resourceBankSkillFindings">;

async function getJobOrThrow(
  ctx: ResourceBankDbCtx,
  jobId: Id<"resourceBankIngestionJobs">,
): Promise<ResourceBankJob> {
  const job = await ctx.db.get(jobId);
  if (!job) throw new Error("resource_bank_job_not_found");
  return job;
}

async function getAssetOrThrow(
  ctx: ResourceBankDbCtx,
  assetId: Id<"resourceBankAssets">,
): Promise<ResourceBankAsset> {
  const asset = await ctx.db.get(assetId);
  if (!asset) throw new Error("resource_bank_asset_not_found");
  return asset;
}

async function getAnalysisOrThrow(
  ctx: ResourceBankDbCtx,
  analysisId: Id<"resourceBankAnalyses">,
): Promise<ResourceBankAnalysis> {
  const analysis = await ctx.db.get(analysisId);
  if (!analysis) throw new Error("resource_bank_analysis_not_found");
  return analysis;
}

function nowMs(): number {
  return Date.now();
}

function rowProjectId(job: ResourceBankJob, fallback?: string): string | undefined {
  return cleanText(fallback, 120) ?? job.projectId;
}

function rowTaskId(job: ResourceBankJob, fallback?: string): string | undefined {
  return cleanText(fallback, 120) ?? job.taskId;
}

function toAssetRow(row: ResourceBankAsset) {
  return {
    _id: row._id,
    parentAssetId: row.parentAssetId,
    title: row.title,
    assetKind: row.assetKind,
    assetRole: row.assetRole,
    tags: row.tags,
    searchableText: row.searchableText,
    projectId: row.projectId,
    taskId: row.taskId,
    createdAtMs: row.createdAtMs,
    updatedAtMs: row.updatedAtMs,
  };
}

function toAnalysisRow(row: ResourceBankAnalysis) {
  return {
    _id: row._id,
    assetId: row.assetId,
    analysisType: row.analysisType,
    whyItWorks: row.whyItWorks,
    takeaways: row.takeaways,
    promptGuess: row.promptGuess,
    remixConstraints: row.remixConstraints,
    embeddingText: row.embeddingText,
    tags: row.tags,
    createdAtMs: row.createdAtMs,
  };
}

function toSkillFindingRow(row: ResourceBankSkillFinding) {
  return {
    _id: row._id,
    assetId: row.assetId,
    findingKind: row.findingKind,
    skillId: row.skillId,
    label: row.label,
    capability: row.capability,
    evidenceAnchor: row.evidenceAnchor,
    howToReuse: row.howToReuse,
    suggestedSkillChange: row.suggestedSkillChange,
    tags: row.tags,
    embeddingText: row.embeddingText,
    createdAtMs: row.createdAtMs,
  };
}

function matchesFilters(
  row: { assetKind?: string; assetRole?: string; findingKind?: string; projectId?: string; taskId?: string; tags: string[] },
  args: {
    assetKind?: string;
    assetRole?: string;
    findingKind?: string;
    projectId?: string;
    taskId?: string;
    tags?: string[];
  },
): boolean {
  if (args.assetKind && row.assetKind !== args.assetKind) return false;
  if (args.assetRole && row.assetRole !== args.assetRole) return false;
  if (args.findingKind && row.findingKind !== args.findingKind) return false;
  if (args.projectId && row.projectId !== args.projectId) return false;
  if (args.taskId && row.taskId !== args.taskId) return false;
  return includesAllTags(row.tags, normalizeTags(args.tags));
}

export const createIngestionJob = mutation({
  args: createIngestionJobArgsValidator,
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
    const assetIds = new Set(filteredAssets.map((asset) => asset._id));
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
      filteredAssets.filter((asset) => assetIds.has(asset._id)).map(toAssetRow),
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

export const findSimilarAssets = action({
  args: findSimilarAssetsArgsValidator,
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

export const seedDemoResourceBank = mutation({
  args: seedDemoArgsValidator,
  handler: async (ctx) => {
    const timestamp = nowMs();
    const jobId = await ctx.db.insert("resourceBankIngestionJobs", {
      sourceKind: "video",
      sourceRef: "https://example.com/reference-video",
      originalInstruction: "I like the first minute, lighting, and editing structure.",
      note: "Relevant for a video I want to make next week.",
      requestedFocus: "first minute, lighting, editing",
      sourceScope: { startMs: 0, endMs: 60_000 },
      tags: ["intent:future-video", "format:short-video", "style:warm-lighting"],
      projectId: "demo-project",
      taskId: "demo-video-task",
      sourcePrivacy: "public",
      status: "ready",
      createdAtMs: timestamp,
      updatedAtMs: timestamp,
      completedAtMs: timestamp,
    });
    const assetId = await ctx.db.insert("resourceBankAssets", {
      ingestionJobId: jobId,
      assetRole: "primary",
      assetKind: "video",
      title: "Warm lighting video structure reference",
      sourceUrl: "https://example.com/reference-video",
      attributionStatus: "unknown",
      tags: ["intent:future-video", "format:short-video", "style:warm-lighting"],
      searchableText:
        "Warm lighting video structure reference. First minute has strong hook, soft side key, fast contrast cuts, and reusable editing structure.",
      projectId: "demo-project",
      taskId: "demo-video-task",
      retentionNote: "Source URL retained; no raw media copied in demo seed.",
      createdAtMs: timestamp,
      updatedAtMs: timestamp,
    });
    const analysisId = await ctx.db.insert("resourceBankAnalyses", {
      ingestionJobId: jobId,
      assetId,
      analysisType: "video",
      sourceSkill: "ingest-content",
      facts: ["The requested scope is the first minute."],
      interpretation: ["Warm side lighting separates the subject from a dense background."],
      userIntent: "Reuse the structure, lighting, and editing technique later.",
      whyItWorks: ["The first minute combines a legible hook with quick contrast edits."],
      takeaways: ["Reuse the lighting setup and pacing map without copying the creator."],
      promptGuess: "Warm side-key talking head, dense background, quick contrast cuts.",
      remixConstraints: ["Do not copy the exact footage, creator identity, or caption wording."],
      confidence: "medium",
      embeddingTarget: "analysis_search",
      embeddingText:
        "Warm lighting. First minute video structure. Quick contrast cuts. Reusable short-form editing technique.",
      projectId: "demo-project",
      taskId: "demo-video-task",
      tags: ["intent:future-video", "format:short-video", "style:warm-lighting"],
      createdAtMs: timestamp,
    });
    const findingId = await ctx.db.insert("resourceBankSkillFindings", {
      ingestionJobId: jobId,
      assetId,
      analysisId,
      findingKind: "skill_candidate",
      label: "Short video lighting and edit-structure breakdown",
      capability: "Break down a reference video's lighting, hook timing, and edit rhythm.",
      evidenceAnchor: "0:00-1:00",
      howToReuse: "Use before video generation to produce a pacing and lighting recipe.",
      suggestedSkillChange:
        "Create or extend a video-generation prep skill that outputs lighting, hook, and edit rhythm recipes.",
      tags: ["skill:video-generation", "skill:video-understanding", "style:warm-lighting"],
      confidence: "medium",
      embeddingTarget: "skill_finding_search",
      embeddingText:
        "Skill candidate for video-generation prep: lighting breakdown, first-minute hook timing, edit rhythm.",
      projectId: "demo-project",
      taskId: "demo-video-task",
      createdAtMs: timestamp,
    });
    return { jobId, assetId, analysisId, findingId };
  },
});
