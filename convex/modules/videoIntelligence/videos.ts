/**
 * Video Intelligence cloud writes. The YouTube loopback bridge calls these mutations;
 * Content owns source identity and job lifecycle; this module owns reporting structure.
 */
import { v } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { mutation } from "../../_generated/server";
import { canonicalYouTubeUrl } from "../content/identifiers";
import { ensureContentSource, getContentJobOrThrow } from "../content/records";
import { timelineDayFromMs, timelineDayFromValue } from "../content/timeline";
import { normalizeTagKey } from "./domain";
import {
  authorityFromYouTubeChannel,
  candidatesForNewsEnrichment,
  evaluateNewsCandidate,
  hasCurrentRevision,
  isYouTubeChannelId,
  topicMonth,
  topicNamesForCoverage,
} from "./editorial";
import { videoAnalysisValidator } from "./validators";

const contentJobStatusValidator = v.union(
  v.literal("queued"),
  v.literal("analyzing"),
  v.literal("ready"),
  v.literal("failed"),
  v.literal("needs_review"),
);

const videoIntelligenceExecutionProfileValidator = v.object({
  definition: v.literal("video_intelligence.analysis.v1"),
  model: v.string(),
  reasoningEffort: v.string(),
});

const queueResultValidator = v.object({
  jobId: v.id("contentJobs"),
  sourceId: v.id("contentSources"),
  videoId: v.string(),
  title: v.string(),
  projectId: v.optional(v.string()),
  disposition: v.union(v.literal("created"), v.literal("reused_active"), v.literal("reused_ready")),
  jobStatus: contentJobStatusValidator,
  dossierId: v.optional(v.id("videoIntelligenceDossiers")),
  createdAtMs: v.number(),
  updatedAtMs: v.number(),
});

export const queueVideo = mutation({
  args: {
    videoId: v.string(),
    title: v.string(),
    projectId: v.optional(v.string()),
    channelId: v.optional(v.string()),
    reAnalyze: v.optional(v.boolean()),
  },
  returns: queueResultValidator,
  handler: async (ctx, args) => {
    if (args.channelId && !isYouTubeChannelId(args.channelId)) {
      throw new Error("video_intelligence_channel_id_invalid");
    }
    const canonicalUrl = canonicalYouTubeUrl(args.videoId);
    const title = clean(args.title, 300) || args.videoId;
    const projectId = clean(args.projectId ?? "", 120) || undefined;
    const now = Date.now();
    const sourceId = await ensureContentSource(ctx, {
      sourceKind: "video",
      sourceRef: canonicalUrl,
      canonicalRef: canonicalUrl,
      title,
      platform: "YouTube",
      youtubeChannelId: args.channelId,
      sourcePrivacy: "public",
      now,
    });
    const activeJobs = (
      await Promise.all(
        (["queued", "analyzing"] as const).map((status) =>
          ctx.db
            .query("contentJobs")
            .withIndex("by_source_kind_status", (q) =>
              q.eq("sourceId", sourceId).eq("kind", "analyze_youtube").eq("status", status),
            )
            .take(1),
        ),
      )
    ).flat();
    const existing = activeJobs.sort((left, right) => right.updatedAtMs - left.updatedAtMs)[0];
    if (existing) {
      return {
        jobId: existing._id,
        sourceId,
        videoId: args.videoId,
        title,
        projectId: existing.projectId,
        disposition: "reused_active" as const,
        jobStatus: existing.status,
        createdAtMs: existing.createdAtMs,
        updatedAtMs: existing.updatedAtMs,
      };
    }
    const readyJob = await ctx.db
      .query("contentJobs")
      .withIndex("by_source_kind_status", (q) =>
        q.eq("sourceId", sourceId).eq("kind", "analyze_youtube").eq("status", "ready"),
      )
      .first();
    if (readyJob && !args.reAnalyze) {
      const dossier = await ctx.db
        .query("videoIntelligenceDossiers")
        .withIndex("by_contentSourceId", (q) => q.eq("contentSourceId", sourceId))
        .first();
      return {
        jobId: readyJob._id,
        sourceId,
        videoId: args.videoId,
        title,
        projectId: readyJob.projectId,
        disposition: "reused_ready" as const,
        jobStatus: readyJob.status,
        dossierId: dossier?._id,
        createdAtMs: readyJob.createdAtMs,
        updatedAtMs: readyJob.updatedAtMs,
      };
    }
    const terminalJob = await ctx.db
      .query("contentJobs")
      .withIndex("by_source_kind_createdAtMs", (q) =>
        q.eq("sourceId", sourceId).eq("kind", "analyze_youtube"),
      )
      .order("desc")
      .first();
    if (terminalJob && !args.reAnalyze) {
      throw new Error("video_intelligence_reanalysis_required");
    }
    const jobId = await ctx.db.insert("contentJobs", {
      sourceId,
      kind: "analyze_youtube",
      originalInstruction: "Analyze this YouTube video for reporting claims and stories.",
      requestedFocus: "Video Intelligence",
      tags: ["youtube", "video-intelligence"],
      projectId,
      requestedBy: "farplane-youtube-shortcut",
      status: "queued",
      createdAtMs: now,
      updatedAtMs: now,
    });
    return {
      jobId,
      sourceId,
      videoId: args.videoId,
      title,
      projectId,
      disposition: "created" as const,
      jobStatus: "queued" as const,
      createdAtMs: now,
      updatedAtMs: now,
    };
  },
});

export const attachThread = mutation({
  args: {
    jobId: v.id("contentJobs"),
    threadId: v.string(),
  },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    const job = await getVideoJobOrThrow(ctx, args.jobId);
    await ctx.db.patch(job._id, {
      status: job.status === "queued" ? "analyzing" : job.status,
      externalTaskRef: `codex-thread:${clean(args.threadId, 180)}`,
      updatedAtMs: Date.now(),
    });
    return { ok: true };
  },
});

export const startVideo = mutation({
  args: {
    jobId: v.id("contentJobs"),
    executionProfile: v.optional(videoIntelligenceExecutionProfileValidator),
  },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    const job = await getVideoJobOrThrow(ctx, args.jobId);
    if (
      job.analysisExecutionProfile &&
      args.executionProfile &&
      (job.analysisExecutionProfile.model !== args.executionProfile.model ||
        job.analysisExecutionProfile.reasoningEffort !== args.executionProfile.reasoningEffort ||
        job.analysisExecutionProfile.definition !== args.executionProfile.definition)
    ) {
      throw new Error("video_intelligence_execution_profile_mismatch");
    }
    if (job.status === "queued" || (!job.analysisExecutionProfile && args.executionProfile)) {
      await ctx.db.patch(job._id, {
        status: "analyzing",
        error: undefined,
        ...(job.analysisExecutionProfile || !args.executionProfile
          ? {}
          : { analysisExecutionProfile: args.executionProfile }),
        updatedAtMs: Date.now(),
      });
    }
    return { ok: true };
  },
});

export const failVideo = mutation({
  args: {
    jobId: v.id("contentJobs"),
    error: v.string(),
    threadId: v.optional(v.string()),
  },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    const job = await getVideoJobOrThrow(ctx, args.jobId);
    await ctx.db.patch(job._id, {
      status: "failed",
      error: clean(args.error, 2_000),
      externalTaskRef: args.threadId ? `codex-thread:${clean(args.threadId, 180)}` : undefined,
      updatedAtMs: Date.now(),
    });
    return { ok: true };
  },
});

export const completeVideo = mutation({
  args: {
    jobId: v.id("contentJobs"),
    videoId: v.string(),
    threadId: v.string(),
    analysis: videoAnalysisValidator,
  },
  returns: v.object({ dossierId: v.id("videoIntelligenceDossiers") }),
  handler: async (ctx, args) => {
    const job = await getVideoJobOrThrow(ctx, args.jobId);
    if (job.status === "ready") throw new Error("video_intelligence_job_already_completed");
    const source = await ctx.db.get(job.sourceId);
    if (!source) throw new Error("video_intelligence_source_missing");
    if (source.canonicalRef !== canonicalYouTubeUrl(args.videoId)) {
      throw new Error("video_intelligence_source_video_mismatch");
    }
    const now = Date.now();
    const existingDossier = await ctx.db
      .query("videoIntelligenceDossiers")
      .withIndex("by_contentSourceId", (q) => q.eq("contentSourceId", job.sourceId))
      .first();
    const dossierFields = {
      contentSourceId: job.sourceId,
      contentJobId: args.jobId,
      videoId: args.videoId,
      youtubeChannelId: source.youtubeChannelId,
      threadId: clean(args.threadId, 200),
      publisher: nullableText(args.analysis.publisher, 300),
      publishedAt: nullableText(args.analysis.publishedAt, 40),
      summary: clean(args.analysis.summary, 3_000),
      sourceStatus: args.analysis.sourceStatus,
      sourceNote: clean(args.analysis.sourceNote, 500),
      projectRelevance: args.analysis.projectRelevance,
      clickbait: args.analysis.clickbait,
      keyPoints: args.analysis.keyPoints,
      recommendation: args.analysis.recommendation,
      duplicateIngestCount: (existingDossier?.duplicateIngestCount ?? 0) + 1,
      timelineDay: timelineDayFromMs(now),
      createdAtMs: existingDossier?.createdAtMs ?? now,
      updatedAtMs: now,
    };
    let dossierId: Id<"videoIntelligenceDossiers">;
    if (existingDossier) {
      await ctx.db.patch(existingDossier._id, dossierFields);
      dossierId = existingDossier._id;
    } else {
      dossierId = await ctx.db.insert("videoIntelligenceDossiers", dossierFields);
    }

    const previousRevision = await ctx.db
      .query("videoIntelligenceAnalysisRevisions")
      .withIndex("by_dossier_lifecycle", (q) =>
        q.eq("dossierId", dossierId).eq("lifecycle", "current"),
      )
      .first();
    const previousContributions = previousRevision
      ? await ctx.db
          .query("videoIntelligenceContributions")
          .withIndex("by_revisionId", (q) => q.eq("revisionId", previousRevision._id))
          .collect()
      : [];
    const previousTopicCoverage = previousRevision
      ? await ctx.db
          .query("videoIntelligenceTopicCoverage")
          .withIndex("by_revisionId", (q) => q.eq("revisionId", previousRevision._id))
          .collect()
      : [];
    const latestRevision = await ctx.db
      .query("videoIntelligenceAnalysisRevisions")
      .withIndex("by_dossier_revisionNumber", (q) => q.eq("dossierId", dossierId))
      .order("desc")
      .first();
    const sourceAuthorityKey = authorityFromYouTubeChannel(source.youtubeChannelId);
    const revisionId = await ctx.db.insert("videoIntelligenceAnalysisRevisions", {
      dossierId,
      contentJobId: args.jobId,
      ...(job.analysisExecutionProfile
        ? { analysisExecutionProfile: job.analysisExecutionProfile }
        : {}),
      revisionNumber: (latestRevision?.revisionNumber ?? 0) + 1,
      lifecycle: "current",
      sourceAuthorityKey,
      createdAtMs: now,
    });
    const eventKeysToRefresh = new Set<string>();
    for (const contribution of previousContributions) {
      const previousStory = await ctx.db.get(contribution.storyId);
      if (
        previousStory?.classification === "news" &&
        previousStory.eventKey &&
        previousStory.eventDate
      ) {
        eventKeysToRefresh.add(`${previousStory.eventKey}\u0000${previousStory.eventDate}`);
      }
    }
    const coveredTopicKeys = new Set<string>();
    const topicIdsToRefresh = new Set<Id<"videoIntelligenceTopics">>();
    for (const extractedTopic of args.analysis.topics) {
      const tagIds = await resolveTags(ctx, topicNamesForCoverage(extractedTopic), dossierId, now);
      const topicIds = await addTopicCoverage(ctx, {
        tagIds,
        dossierId,
        revisionId,
        sourceAuthorityKey,
        timelineDay: timelineDayFromMs(now),
        summary: clean(extractedTopic.summary, 1_500),
        frame: clean(extractedTopic.frame, 1_000),
        now,
        coveredTopicKeys,
      });
      for (const topicId of topicIds) topicIdsToRefresh.add(topicId);
    }
    for (const extractedStory of candidatesForNewsEnrichment(args.analysis.news)) {
      const tagIds = await resolveTags(ctx, extractedStory.tags, dossierId, now);
      const editorial = evaluateNewsCandidate(extractedStory, now);
      let contributionId: Id<"videoIntelligenceContributions"> | undefined;
      if (editorial.eligible) {
        const matchingStory = await ctx.db
          .query("videoIntelligenceStories")
          .withIndex("by_eventKey_eventDate", (q) =>
            q.eq("eventKey", editorial.eventKey).eq("eventDate", editorial.eventDay),
          )
          .first();
        const storyId =
          matchingStory?._id ??
          (await ctx.db.insert("videoIntelligenceStories", {
            title: clean(extractedStory.title, 300),
            summary: clean(extractedStory.summary, 1_500),
            eventDate: editorial.eventDay,
            eventKey: editorial.eventKey,
            whyNow: clean(editorial.whyNow, 500),
            whyItMatters: clean(editorial.whyItMatters, 800),
            entities: extractedStory.entities.map((item) => clean(item, 160)).filter(Boolean),
            tagIds,
            status: "provisional",
            classification: "news",
            editorialStatus: "developing",
            timelineDay: editorial.eventDay,
            createdAtMs: now,
            updatedAtMs: now,
          }));
        if (matchingStory) {
          await ctx.db.patch(storyId, {
            title: clean(extractedStory.title, 300),
            summary: clean(extractedStory.summary, 1_500),
            whyNow: clean(editorial.whyNow, 500),
            whyItMatters: clean(editorial.whyItMatters, 800),
            entities: [...new Set([...matchingStory.entities, ...extractedStory.entities])],
            tagIds: [...new Set([...matchingStory.tagIds, ...tagIds])],
            classification: "news",
            editorialStatus: "developing",
            visibleInNews: false,
            updatedAtMs: now,
          });
        }
        contributionId = await ctx.db.insert("videoIntelligenceContributions", {
          storyId,
          dossierId,
          revisionId,
          sourceAuthorityKey,
          frame: clean(extractedStory.frame, 1_000),
          summary: clean(extractedStory.summary, 1_500),
          claims: extractedStory.claims.map((claim) => ({
            statement: clean(claim.statement, 800),
            stance: claim.stance,
            evidence: {
              videoId: args.videoId,
              sourceUrl: canonicalYouTubeUrl(args.videoId),
              sourceStatus: args.analysis.sourceStatus,
              sourceKind:
                args.analysis.sourceStatus === "TRANSCRIPT_USED" ? "transcript" : "page-owned",
              timestamp: claim.evidence.timestamp,
              excerpt: clean(claim.evidence.excerpt, 500),
              schemaVersion: 2,
              extractorVersion: clean(claim.evidence.extractorVersion, 120),
              ...(claim.evidence.reference
                ? { reference: clean(claim.evidence.reference, 2_000) }
                : {}),
            },
          })),
          createdAtMs: now,
          updatedAtMs: now,
        });
        eventKeysToRefresh.add(`${editorial.eventKey}\u0000${editorial.eventDay}`);
      }
      const topicIds = await addTopicCoverage(ctx, {
        tagIds,
        dossierId,
        revisionId,
        contributionId,
        sourceAuthorityKey,
        timelineDay: timelineDayFromValue(extractedStory.eventDate ?? undefined, now),
        summary: clean(extractedStory.summary, 1_500),
        frame: clean(extractedStory.frame, 1_000),
        now,
        coveredTopicKeys,
      });
      for (const topicId of topicIds) topicIdsToRefresh.add(topicId);
    }
    if (previousRevision) {
      await ctx.db.patch(previousRevision._id, { lifecycle: "superseded", supersededAtMs: now });
    }
    for (const coverage of previousTopicCoverage) topicIdsToRefresh.add(coverage.topicId);
    for (const topicId of topicIdsToRefresh) {
      await refreshTopicVisibility(ctx, topicId, now);
    }
    for (const composite of eventKeysToRefresh) {
      const [eventKey, eventDay] = composite.split("\u0000");
      await refreshEditorialStatus(ctx, eventKey, eventDay, now);
    }
    await ctx.db.patch(args.jobId, {
      status: "ready",
      error: undefined,
      externalTaskRef: `codex-thread:${clean(args.threadId, 180)}`,
      completedAtMs: now,
      updatedAtMs: now,
    });
    return { dossierId };
  },
});

async function resolveTags(
  ctx: MutationCtx,
  names: string[],
  dossierId: Id<"videoIntelligenceDossiers">,
  now: number,
): Promise<Id<"videoIntelligenceTags">[]> {
  const ids: Id<"videoIntelligenceTags">[] = [];
  for (const rawName of names) {
    const canonicalName = clean(rawName, 80);
    const normalizedKey = normalizeTagKey(canonicalName);
    if (!normalizedKey) continue;
    const existing = await ctx.db
      .query("videoIntelligenceTags")
      .withIndex("by_normalizedKey", (q) => q.eq("normalizedKey", normalizedKey))
      .first();
    if (existing) {
      const aliases =
        existing.canonicalName !== canonicalName && !existing.aliases.includes(canonicalName)
          ? [...existing.aliases, canonicalName]
          : existing.aliases;
      const provenance = existing.provenance.some((item) => item.dossierId === dossierId)
        ? existing.provenance
        : [...existing.provenance, { source: "analysis" as const, dossierId, firstSeenAtMs: now }];
      await ctx.db.patch(existing._id, { aliases, provenance, updatedAtMs: now });
      ids.push(existing._id);
    } else {
      ids.push(
        await ctx.db.insert("videoIntelligenceTags", {
          canonicalName,
          normalizedKey,
          aliases: [],
          provenance: [{ source: "analysis", dossierId, firstSeenAtMs: now }],
          createdAtMs: now,
          updatedAtMs: now,
        }),
      );
    }
  }
  return [...new Set(ids)];
}

async function addTopicCoverage(
  ctx: MutationCtx,
  input: {
    tagIds: Id<"videoIntelligenceTags">[];
    dossierId: Id<"videoIntelligenceDossiers">;
    revisionId: Id<"videoIntelligenceAnalysisRevisions">;
    contributionId?: Id<"videoIntelligenceContributions">;
    sourceAuthorityKey?: string;
    timelineDay: string;
    summary: string;
    frame: string;
    now: number;
    coveredTopicKeys: Set<string>;
  },
): Promise<Id<"videoIntelligenceTopics">[]> {
  const month = topicMonth(input.timelineDay);
  if (!month) return [];
  const topicIds: Id<"videoIntelligenceTopics">[] = [];
  for (const tagId of input.tagIds) {
    const tag = await ctx.db.get(tagId);
    if (!tag) continue;
    const coverageKey = `${month}\u0000${tag.normalizedKey}`;
    if (input.coveredTopicKeys.has(coverageKey)) continue;
    input.coveredTopicKeys.add(coverageKey);
    const existing = await ctx.db
      .query("videoIntelligenceTopics")
      .withIndex("by_month_normalizedKey", (q) =>
        q.eq("month", month).eq("normalizedKey", tag.normalizedKey),
      )
      .first();
    const topicId =
      existing?._id ??
      (await ctx.db.insert("videoIntelligenceTopics", {
        month,
        normalizedKey: tag.normalizedKey,
        title: tag.canonicalName,
        visibleInTopics: false,
        createdAtMs: input.now,
        updatedAtMs: input.now,
      }));
    if (existing) await ctx.db.patch(topicId, { updatedAtMs: input.now });
    topicIds.push(topicId);
    await ctx.db.insert("videoIntelligenceTopicCoverage", {
      topicId,
      dossierId: input.dossierId,
      revisionId: input.revisionId,
      contributionId: input.contributionId,
      sourceAuthorityKey: input.sourceAuthorityKey,
      summary: input.summary,
      frame: input.frame,
      timelineDay: input.timelineDay,
      createdAtMs: input.now,
    });
  }
  return topicIds;
}

async function refreshEditorialStatus(
  ctx: MutationCtx,
  eventKey: string,
  eventDay: string,
  now: number,
) {
  const stories = await ctx.db
    .query("videoIntelligenceStories")
    .withIndex("by_eventKey_eventDate", (q) => q.eq("eventKey", eventKey).eq("eventDate", eventDay))
    .collect();
  for (const story of stories) {
    if (story.classification !== "news") continue;
    const contributions = await ctx.db
      .query("videoIntelligenceContributions")
      .withIndex("by_storyId", (q) => q.eq("storyId", story._id))
      .collect();
    const authorities = new Set<string>();
    for (const contribution of contributions) {
      if (!contribution.revisionId || !contribution.sourceAuthorityKey) continue;
      const revision = await ctx.db.get(contribution.revisionId);
      if (revision?.lifecycle === "current") authorities.add(contribution.sourceAuthorityKey);
    }
    await ctx.db.patch(
      story._id,
      authorities.size === 0
        ? {
            classification: "dossier_only",
            editorialStatus: "developing",
            visibleInNews: false,
            updatedAtMs: now,
          }
        : {
            editorialStatus: authorities.size >= 2 ? "aggregated" : "developing",
            visibleInNews: true,
            updatedAtMs: now,
          },
    );
  }
}

async function refreshTopicVisibility(
  ctx: MutationCtx,
  topicId: Id<"videoIntelligenceTopics">,
  now: number,
) {
  const coverage = await ctx.db
    .query("videoIntelligenceTopicCoverage")
    .withIndex("by_topicId_createdAtMs", (q) => q.eq("topicId", topicId))
    .collect();
  for (const item of coverage) {
    if (!item.revisionId) continue;
    const revision = await ctx.db.get(item.revisionId);
    if (hasCurrentRevision(revision ? [revision.lifecycle] : [])) {
      await ctx.db.patch(topicId, { visibleInTopics: true, updatedAtMs: now });
      return;
    }
  }
  await ctx.db.patch(topicId, { visibleInTopics: false, updatedAtMs: now });
}

async function getVideoJobOrThrow(ctx: MutationCtx, jobId: Id<"contentJobs">) {
  const job = await getContentJobOrThrow(ctx, jobId);
  if (job.kind !== "analyze_youtube") throw new Error("video_intelligence_job_kind_invalid");
  return job;
}

function nullableText(value: string | null, max: number): string | undefined {
  return value === null ? undefined : clean(value, max) || undefined;
}

function clean(value: string, max: number): string {
  return value.trim().replace(/\s+/g, " ").slice(0, max);
}
