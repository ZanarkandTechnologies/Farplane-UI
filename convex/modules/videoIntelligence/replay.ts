/**
 * Preview-first stored dossier replay. It repairs deterministic metadata/progress and
 * upserts only externally agent-vetted comparisons; it never deletes or infers semantics.
 */
import { v } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import type { QueryCtx } from "../../_generated/server";
import { mutation, query } from "../../_generated/server";
import { timelineDayFromMs } from "../content/timeline";
import { comparisonWindowStartDay, normalizePublisherKey, publicationDay } from "./comparisonRules";
import { buildComparisonCandidatePacket, upsertComparisonDecision } from "./comparisons";
import {
  classifyReplayReadiness,
  cleanTrustedPublisher,
  planSourceObservationRepair,
  planStoredJobProgressRepair,
  planTrustedMetadataRepair,
} from "./replayModel";
import { comparisonRelationshipValidator } from "./validators";

const REPLAY_CONFIRMATION = "replay-stored-video-intelligence-v1";
const MAX_REPLAY_BATCH = 10;
const MAX_REPLAY_DECISIONS = 80;
const MAX_METADATA_REPAIRS = 20;

const replayDecisionValidator = v.object({
  originRevisionId: v.id("videoIntelligenceAnalysisRevisions"),
  candidateSourceId: v.id("contentSources"),
  candidateRevisionId: v.id("videoIntelligenceAnalysisRevisions"),
  relationship: comparisonRelationshipValidator,
  rationale: v.string(),
});

const metadataRepairValidator = v.object({
  dossierId: v.id("videoIntelligenceDossiers"),
  publishedAt: v.optional(v.string()),
  publisher: v.optional(v.string()),
  creatorAuthorityKey: v.optional(v.string()),
});

export const previewStoredReplay = query({
  args: {
    cursor: v.union(v.string(), v.null()),
    limit: v.optional(v.number()),
    includeCandidates: v.optional(v.boolean()),
    candidateLimit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const dossiers = await replayPage(ctx, args.cursor, boundedLimit(args.limit));
    const asOfDay = timelineDayFromMs(Date.now());
    const items = await Promise.all(
      dossiers.page.map((dossier) =>
        inspectDossier(ctx, dossier, asOfDay, Boolean(args.includeCandidates), args.candidateLimit),
      ),
    );
    return {
      scanned: items.length,
      readyForReplay: items.filter((item) => item.readyForReplay).length,
      needsReanalysis: items.filter((item) => item.needsReanalysis).length,
      missingProgress: items.filter((item) => item.missingProgress).length,
      missingMetadata: items.filter((item) => item.missingMetadata).length,
      missingPublishedAt: items.filter((item) => item.missingPublishedAt).length,
      missingPublisher: items.filter((item) => item.missingPublisher).length,
      missingTimelineDay: items.filter((item) => item.missingTimelineDay).length,
      items,
      continueCursor: dossiers.continueCursor,
      isDone: dossiers.isDone,
    };
  },
});

/**
 * Preview legacy Analyze jobs independently from dossiers. Some failed or stale
 * queued jobs never produced a dossier, so dossier replay cannot initialize
 * their persisted progress field.
 */
export const previewStoredJobProgress = query({
  args: {
    cursor: v.union(v.string(), v.null()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const jobs = await analysisJobPage(ctx, args.cursor, boundedLimit(args.limit));
    return {
      scanned: jobs.page.length,
      missingProgress: jobs.page.filter((job) => !job.progress).length,
      needsTimestampRepair: jobs.page.filter(
        (job) => planStoredJobProgressRepair(job)?.kind === "restore_timestamp",
      ).length,
      items: jobs.page.map((job) => ({
        jobId: String(job._id),
        sourceId: String(job.sourceId),
        status: job.status,
        hasProgress: Boolean(job.progress),
        createdAtMs: job.createdAtMs,
        error: job.error ?? null,
      })),
      continueCursor: jobs.continueCursor,
      isDone: jobs.isDone,
    };
  },
});

/** Missing-only, cursor-bounded repair for every legacy Analyze job. */
export const replayStoredJobProgressBatch = mutation({
  args: {
    confirm: v.string(),
    cursor: v.union(v.string(), v.null()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (args.confirm !== REPLAY_CONFIRMATION) {
      throw new Error("video_intelligence_replay_not_confirmed");
    }
    const jobs = await ctx.db
      .query("contentJobs")
      .withIndex("by_kind_createdAtMs", (q) => q.eq("kind", "analyze_youtube"))
      .order("asc")
      .paginate({ cursor: args.cursor, numItems: boundedLimit(args.limit) });
    let progressUpdated = 0;
    let timestampsRestored = 0;
    for (const job of jobs.page) {
      const plan = planStoredJobProgressRepair(job);
      if (!plan) continue;
      await ctx.db.patch(job._id, {
        progress: plan.progress,
        ...(plan.kind === "restore_timestamp" ? { updatedAtMs: plan.jobUpdatedAtMs } : {}),
      });
      if (plan.kind === "initialize") progressUpdated += 1;
      else timestampsRestored += 1;
    }
    return {
      scanned: jobs.page.length,
      progressUpdated,
      timestampsRestored,
      continueCursor: jobs.continueCursor,
      isDone: jobs.isDone,
    };
  },
});

export const replayStoredBatch = mutation({
  args: {
    confirm: v.string(),
    cursor: v.union(v.string(), v.null()),
    limit: v.optional(v.number()),
    decisions: v.array(replayDecisionValidator),
    metadataRepairs: v.array(metadataRepairValidator),
  },
  handler: async (ctx, args) => {
    if (args.confirm !== REPLAY_CONFIRMATION) {
      throw new Error("video_intelligence_replay_not_confirmed");
    }
    if (args.decisions.length > MAX_REPLAY_DECISIONS) {
      throw new Error("video_intelligence_replay_decision_limit_exceeded");
    }
    if (args.metadataRepairs.length > MAX_METADATA_REPAIRS) {
      throw new Error("video_intelligence_replay_metadata_limit_exceeded");
    }
    const dossiers = await ctx.db
      .query("videoIntelligenceDossiers")
      .withIndex("by_updatedAtMs")
      .order("asc")
      .paginate({ cursor: args.cursor, numItems: boundedLimit(args.limit) });
    const now = Date.now();
    const dossiersById = new Map(dossiers.page.map((dossier) => [String(dossier._id), dossier]));
    const repairedDossiers = new Set<string>();
    let publishedAtUpdated = 0;
    let publisherUpdated = 0;
    let creatorAuthorityUpdated = 0;
    let metadataRepairsUnchanged = 0;
    for (const repair of args.metadataRepairs) {
      const dossierKey = String(repair.dossierId);
      const dossier = dossiersById.get(dossierKey);
      if (!dossier) throw new Error("video_intelligence_replay_metadata_outside_page");
      if (repairedDossiers.has(dossierKey)) {
        throw new Error("video_intelligence_replay_metadata_duplicate");
      }
      repairedDossiers.add(dossierKey);
      const plan = planTrustedMetadataRepair(dossier, repair);
      if ("reason" in plan) throw new Error(plan.reason);
      if (plan.patch.publishedAt) publishedAtUpdated += 1;
      if (plan.patch.publisher) publisherUpdated += 1;
      let creatorUpdated = false;
      if (plan.creatorAuthorityKey) {
        const revision = await currentRevision(ctx, dossier._id);
        if (revision && !revision.sourceAuthorityKey) {
          await ctx.db.patch(revision._id, { sourceAuthorityKey: plan.creatorAuthorityKey });
          creatorAuthorityUpdated += 1;
          creatorUpdated = true;
        }
      }
      if (Object.keys(plan.patch).length > 0) await ctx.db.patch(dossier._id, plan.patch);
      else if (!creatorUpdated) metadataRepairsUnchanged += 1;
    }
    const allowedOriginRevisions = new Set<string>();
    let progressUpdated = 0;
    let timelineDayUpdated = 0;
    let sourceObservationUpdated = 0;
    let needsReanalysis = 0;
    for (const dossier of dossiers.page) {
      const revision = await currentRevision(ctx, dossier._id);
      if (revision) allowedOriginRevisions.add(String(revision._id));
      if (!dossier.contentSourceId || !revision) needsReanalysis += 1;
      if (!dossier.timelineDay) {
        await ctx.db.patch(dossier._id, { timelineDay: timelineDayFromMs(dossier.updatedAtMs) });
        timelineDayUpdated += 1;
      }
      if (dossier.contentSourceId) {
        const source = await ctx.db.get(dossier.contentSourceId);
        const observationPatch = source
          ? planSourceObservationRepair({
              sourceTimelineDay: source.timelineDay,
              sourceUpdatedAtMs: source.updatedAtMs,
              dossierTimelineDay: dossier.timelineDay ?? timelineDayFromMs(dossier.updatedAtMs),
              dossierUpdatedAtMs: dossier.updatedAtMs,
            })
          : null;
        if (observationPatch) {
          await ctx.db.patch(dossier.contentSourceId, observationPatch);
          sourceObservationUpdated += 1;
        }
      }
      if (!dossier.contentJobId) continue;
      const job = await ctx.db.get(dossier.contentJobId);
      if (!job) continue;
      const plan = planStoredJobProgressRepair(job);
      if (!plan) continue;
      await ctx.db.patch(job._id, {
        progress: plan.progress,
        ...(plan.kind === "restore_timestamp" ? { updatedAtMs: plan.jobUpdatedAtMs } : {}),
      });
      if (plan.kind === "initialize") progressUpdated += 1;
    }
    let comparisonsCreated = 0;
    let comparisonsUpdated = 0;
    let comparisonsUnchanged = 0;
    for (const decision of args.decisions) {
      if (!allowedOriginRevisions.has(String(decision.originRevisionId))) {
        throw new Error("video_intelligence_replay_origin_outside_page");
      }
      const result = await upsertComparisonDecision(ctx, {
        ...decision,
        asOfDay: timelineDayFromMs(now),
        now,
      });
      if (result.disposition === "created") comparisonsCreated += 1;
      else if (result.disposition === "updated") comparisonsUpdated += 1;
      else comparisonsUnchanged += 1;
    }
    return {
      scanned: dossiers.page.length,
      progressUpdated,
      publishedAtUpdated,
      publisherUpdated,
      creatorAuthorityUpdated,
      timelineDayUpdated,
      sourceObservationUpdated,
      metadataRepairsUnchanged,
      needsReanalysis,
      comparisonsCreated,
      comparisonsUpdated,
      comparisonsUnchanged,
      continueCursor: dossiers.continueCursor,
      isDone: dossiers.isDone,
    };
  },
});

async function inspectDossier(
  ctx: QueryCtx,
  dossier: Doc<"videoIntelligenceDossiers">,
  asOfDay: string,
  includeCandidates: boolean,
  candidateLimit: number | undefined,
) {
  const [revision, job, source] = await Promise.all([
    currentRevision(ctx, dossier._id),
    dossier.contentJobId ? ctx.db.get(dossier.contentJobId) : null,
    dossier.contentSourceId ? ctx.db.get(dossier.contentSourceId) : null,
  ]);
  const usablePublicationDay = publicationDay(dossier.publishedAt);
  const comparisonWindowEligible = Boolean(
    usablePublicationDay &&
      usablePublicationDay >= comparisonWindowStartDay(asOfDay) &&
      usablePublicationDay <= asOfDay,
  );
  const creatorIdentity =
    revision?.sourceAuthorityKey ?? (normalizePublisherKey(dossier.publisher) || null);
  const readiness = classifyReplayReadiness({
    hasContentSource: Boolean(dossier.contentSourceId),
    hasCurrentRevision: Boolean(revision),
    hasContentJob: Boolean(job),
    hasProgress: Boolean(job?.progress),
    hasUsablePublicationDate: Boolean(usablePublicationDay),
    hasCreatorIdentity: Boolean(creatorIdentity),
    hasPublisher: Boolean(cleanTrustedPublisher(dossier.publisher ?? "")),
    hasTimelineDay: Boolean(dossier.timelineDay),
  });
  const packet =
    dossier.contentSourceId &&
    revision &&
    readiness.readyForReplay &&
    comparisonWindowEligible &&
    includeCandidates
      ? await buildComparisonCandidatePacket(ctx, dossier.contentSourceId, asOfDay, candidateLimit)
      : null;
  return {
    dossierId: String(dossier._id),
    videoId: dossier.videoId,
    sourceId: dossier.contentSourceId ? String(dossier.contentSourceId) : null,
    title: source?.title ?? dossier.videoId,
    canonicalUrl: source?.canonicalRef ?? null,
    originRevisionId: revision ? String(revision._id) : null,
    creatorIdentity,
    publisher: dossier.publisher ?? null,
    publishedAt: dossier.publishedAt ?? null,
    publicationDay: usablePublicationDay,
    comparisonWindowEligible,
    timelineDay: dossier.timelineDay ?? null,
    ...readiness,
    candidates:
      packet?.candidates.map((candidate) => ({
        ...candidate,
        keyPoints: candidate.keyPoints.map((point) => point.finding),
      })) ?? [],
  };
}

async function currentRevision(
  ctx: Pick<QueryCtx, "db">,
  dossierId: Id<"videoIntelligenceDossiers">,
) {
  return await ctx.db
    .query("videoIntelligenceAnalysisRevisions")
    .withIndex("by_dossier_lifecycle", (q) =>
      q.eq("dossierId", dossierId).eq("lifecycle", "current"),
    )
    .first();
}

async function replayPage(ctx: QueryCtx, cursor: string | null, limit: number) {
  return await ctx.db
    .query("videoIntelligenceDossiers")
    .withIndex("by_updatedAtMs")
    .order("asc")
    .paginate({ cursor, numItems: limit });
}

async function analysisJobPage(ctx: QueryCtx, cursor: string | null, limit: number) {
  return await ctx.db
    .query("contentJobs")
    .withIndex("by_kind_createdAtMs", (q) => q.eq("kind", "analyze_youtube"))
    .order("asc")
    .paginate({ cursor, numItems: limit });
}

function boundedLimit(value: number | undefined): number {
  return Math.max(1, Math.min(Math.floor(value ?? MAX_REPLAY_BATCH), MAX_REPLAY_BATCH));
}
