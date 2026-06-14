// Shared Resource Bank record helpers for Convex mutations, queries, and actions.
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { cleanText, includesAllTags, normalizeTags } from "./resourceBank";

export type ResourceBankDbCtx = Pick<MutationCtx | QueryCtx, "db">;
export type ResourceBankJob = Doc<"resourceBankIngestionJobs">;
export type ResourceBankAsset = Doc<"resourceBankAssets">;
export type ResourceBankAnalysis = Doc<"resourceBankAnalyses">;
export type ResourceBankSkillFinding = Doc<"resourceBankSkillFindings">;

export async function getJobOrThrow(
  ctx: ResourceBankDbCtx,
  jobId: Id<"resourceBankIngestionJobs">,
): Promise<ResourceBankJob> {
  const job = await ctx.db.get(jobId);
  if (!job) throw new Error("resource_bank_job_not_found");
  return job;
}

export async function getAssetOrThrow(
  ctx: ResourceBankDbCtx,
  assetId: Id<"resourceBankAssets">,
): Promise<ResourceBankAsset> {
  const asset = await ctx.db.get(assetId);
  if (!asset) throw new Error("resource_bank_asset_not_found");
  return asset;
}

export async function getAnalysisOrThrow(
  ctx: ResourceBankDbCtx,
  analysisId: Id<"resourceBankAnalyses">,
): Promise<ResourceBankAnalysis> {
  const analysis = await ctx.db.get(analysisId);
  if (!analysis) throw new Error("resource_bank_analysis_not_found");
  return analysis;
}

export function nowMs(): number {
  return Date.now();
}

export function rowProjectId(job: ResourceBankJob, fallback?: string): string | undefined {
  return cleanText(fallback, 120) ?? job.projectId;
}

export function rowTaskId(job: ResourceBankJob, fallback?: string): string | undefined {
  return cleanText(fallback, 120) ?? job.taskId;
}

export function toAssetRow(row: ResourceBankAsset) {
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

export function toAnalysisRow(row: ResourceBankAnalysis) {
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

export function toSkillFindingRow(row: ResourceBankSkillFinding) {
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

export function matchesFilters(
  row: {
    assetKind?: string;
    assetRole?: string;
    findingKind?: string;
    projectId?: string;
    taskId?: string;
    tags: string[];
  },
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
