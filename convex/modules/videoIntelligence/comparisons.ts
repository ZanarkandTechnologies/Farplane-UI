/**
 * Comparison queries and writes connect current dossier revisions through canonical sources.
 * Queries are bounded/indexed; writes revalidate recency, source identity, and revision lifecycle.
 */
import { v } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { query } from "../../_generated/server";
import { getContentJobOrThrow } from "../content/records";
import { timelineDayFromMs } from "../content/timeline";
import {
  type ComparisonRelationship,
  canonicalComparisonPair,
  comparisonEdgeChanged,
  comparisonWindowStartDay,
  evaluateComparisonFacts,
  MAX_COMPARISON_CANDIDATES,
} from "./comparisonRules";
import { authorityFromYouTubeChannel } from "./editorial";

const DEFAULT_CANDIDATE_LIMIT = 12;
const MAX_CANDIDATE_SCAN = 60;

export const getComparisonCandidates = query({
  args: { jobId: v.id("contentJobs"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const job = await getContentJobOrThrow(ctx, args.jobId);
    if (job.kind !== "analyze_youtube") throw new Error("comparison_job_kind_invalid");
    return await buildComparisonCandidatePacket(
      ctx,
      job.sourceId,
      timelineDayFromMs(Date.now()),
      boundedCandidateLimit(args.limit),
    );
  },
});

export async function buildComparisonCandidatePacket(
  ctx: QueryCtx,
  originSourceId: Id<"contentSources">,
  asOfDay: string,
  limit = DEFAULT_CANDIDATE_LIMIT,
) {
  const originSource = await ctx.db.get(originSourceId);
  if (!originSource) throw new Error("comparison_origin_source_missing");
  const originDossier = await ctx.db
    .query("videoIntelligenceDossiers")
    .withIndex("by_contentSourceId", (q) => q.eq("contentSourceId", originSourceId))
    .first();
  const originRevision = originDossier
    ? await ctx.db
        .query("videoIntelligenceAnalysisRevisions")
        .withIndex("by_dossier_lifecycle", (q) =>
          q.eq("dossierId", originDossier._id).eq("lifecycle", "current"),
        )
        .first()
    : null;
  const windowStartDay = comparisonWindowStartDay(asOfDay);
  const boundedLimit = boundedCandidateLimit(limit);
  const candidateDossiers = await ctx.db
    .query("videoIntelligenceDossiers")
    .withIndex("by_publishedAt", (q) =>
      q.gte("publishedAt", windowStartDay).lte("publishedAt", `${asOfDay}\uffff`),
    )
    .order("desc")
    .take(Math.min(MAX_CANDIDATE_SCAN, Math.max(boundedLimit * 3, boundedLimit)));
  const candidates = [];
  for (const dossier of candidateDossiers) {
    if (candidates.length >= boundedLimit) break;
    if (!dossier.contentSourceId) continue;
    const revision = await ctx.db
      .query("videoIntelligenceAnalysisRevisions")
      .withIndex("by_dossier_lifecycle", (q) =>
        q.eq("dossierId", dossier._id).eq("lifecycle", "current"),
      )
      .first();
    if (!revision) continue;
    const gate = evaluateComparisonFacts({
      asOfDay,
      originSourceId: String(originSourceId),
      originAuthorityKey:
        originRevision?.sourceAuthorityKey ??
        authorityFromYouTubeChannel(originSource.youtubeChannelId),
      originPublisher: originDossier?.publisher,
      originRevisionLifecycle: "current",
      candidateSourceId: String(dossier.contentSourceId),
      candidateAuthorityKey: revision.sourceAuthorityKey,
      candidatePublisher: dossier.publisher,
      candidateRevisionLifecycle: revision.lifecycle,
      candidatePublishedAt: dossier.publishedAt,
    });
    if (!gate.eligible) continue;
    const source = await ctx.db.get(dossier.contentSourceId);
    if (!source) continue;
    candidates.push({
      sourceId: String(source._id),
      dossierId: String(dossier._id),
      revisionId: String(revision._id),
      canonicalUrl: source.canonicalRef,
      title: source.title ?? dossier.videoId,
      publisher: dossier.publisher ?? null,
      publishedAt: dossier.publishedAt ?? gate.candidateDay,
      summary: dossier.summary,
      keyPoints: dossier.keyPoints,
    });
  }
  return {
    status: "complete" as const,
    asOfDay,
    windowStartDay,
    limitation: null,
    candidates,
  };
}

export async function upsertComparisonDecision(
  ctx: MutationCtx,
  input: {
    originRevisionId: Id<"videoIntelligenceAnalysisRevisions">;
    candidateSourceId: Id<"contentSources">;
    candidateRevisionId: Id<"videoIntelligenceAnalysisRevisions">;
    relationship: ComparisonRelationship;
    rationale: string;
    asOfDay: string;
    now: number;
  },
): Promise<{ disposition: "created" | "updated" | "unchanged" }> {
  const [originRevision, candidateRevision, candidateSource] = await Promise.all([
    ctx.db.get(input.originRevisionId),
    ctx.db.get(input.candidateRevisionId),
    ctx.db.get(input.candidateSourceId),
  ]);
  if (!originRevision) throw new Error("comparison_origin_revision_missing");
  if (!candidateRevision) throw new Error("comparison_candidate_revision_missing");
  if (!candidateSource) throw new Error("comparison_candidate_source_missing");
  const [originDossier, candidateDossier] = await Promise.all([
    ctx.db.get(originRevision.dossierId),
    ctx.db.get(candidateRevision.dossierId),
  ]);
  if (!originDossier?.contentSourceId) throw new Error("comparison_origin_source_missing");
  if (!candidateDossier?.contentSourceId) throw new Error("comparison_candidate_source_missing");
  if (candidateDossier.contentSourceId !== candidateSource._id) {
    throw new Error("comparison_candidate_source_revision_mismatch");
  }
  const originSource = await ctx.db.get(originDossier.contentSourceId);
  if (!originSource) throw new Error("comparison_origin_source_missing");
  const gate = evaluateComparisonFacts({
    asOfDay: input.asOfDay,
    originSourceId: String(originSource._id),
    originAuthorityKey: originRevision.sourceAuthorityKey,
    originPublisher: originDossier.publisher,
    originRevisionLifecycle: originRevision.lifecycle,
    candidateSourceId: String(candidateSource._id),
    candidateAuthorityKey: candidateRevision.sourceAuthorityKey,
    candidatePublisher: candidateDossier.publisher,
    candidateRevisionLifecycle: candidateRevision.lifecycle,
    candidatePublishedAt: candidateDossier.publishedAt,
  });
  if ("reason" in gate) throw new Error(gate.reason);
  const rationale = clean(input.rationale, 1_000);
  if (!rationale) throw new Error("comparison_rationale_missing");
  const canonical = canonicalComparisonPair(
    String(originRevision._id),
    String(candidateRevision._id),
  );
  const sideA = canonical.swapped
    ? {
        sourceId: candidateSource._id,
        dossierId: candidateDossier._id,
        revisionId: candidateRevision._id,
      }
    : {
        sourceId: originSource._id,
        dossierId: originDossier._id,
        revisionId: originRevision._id,
      };
  const sideB = canonical.swapped
    ? {
        sourceId: originSource._id,
        dossierId: originDossier._id,
        revisionId: originRevision._id,
      }
    : {
        sourceId: candidateSource._id,
        dossierId: candidateDossier._id,
        revisionId: candidateRevision._id,
      };
  const existing = await ctx.db
    .query("videoIntelligenceComparisonEdges")
    .withIndex("by_pairKey", (q) => q.eq("pairKey", canonical.pairKey))
    .first();
  if (existing) {
    if (!comparisonEdgeChanged(existing, { relationship: input.relationship, rationale })) {
      return { disposition: "unchanged" };
    }
    await ctx.db.patch(existing._id, {
      relationship: input.relationship,
      rationale,
      updatedAtMs: input.now,
    });
    return { disposition: "updated" };
  }
  await ctx.db.insert("videoIntelligenceComparisonEdges", {
    pairKey: canonical.pairKey,
    sourceAId: sideA.sourceId,
    dossierAId: sideA.dossierId,
    revisionAId: sideA.revisionId,
    sourceBId: sideB.sourceId,
    dossierBId: sideB.dossierId,
    revisionBId: sideB.revisionId,
    relationship: input.relationship,
    rationale,
    createdAtMs: input.now,
    updatedAtMs: input.now,
  });
  return { disposition: "created" };
}

export function normalizeComparisonIds(
  ctx: Pick<MutationCtx, "db">,
  candidateSourceId: string,
  candidateRevisionId: string,
): {
  candidateSourceId: Id<"contentSources">;
  candidateRevisionId: Id<"videoIntelligenceAnalysisRevisions">;
} {
  const sourceId = ctx.db.normalizeId("contentSources", candidateSourceId);
  const revisionId = ctx.db.normalizeId("videoIntelligenceAnalysisRevisions", candidateRevisionId);
  if (!sourceId || !revisionId) throw new Error("comparison_candidate_id_invalid");
  return { candidateSourceId: sourceId, candidateRevisionId: revisionId };
}

function boundedCandidateLimit(value: number | undefined): number {
  return Math.max(
    1,
    Math.min(Math.floor(value ?? DEFAULT_CANDIDATE_LIMIT), MAX_COMPARISON_CANDIDATES),
  );
}

function clean(value: string, max: number): string {
  return value.trim().replace(/\s+/g, " ").slice(0, max);
}
