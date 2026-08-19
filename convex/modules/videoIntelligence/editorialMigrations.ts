/** Development-only, cursor-safe migration from permissive Stories to dossier evidence + Topics. */
import { v } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { mutation, query } from "../../_generated/server";
import { timelineDayFromValue } from "../content/timeline";
import { normalizeTagKey } from "./domain";
import {
  hasCurrentRevision,
  newsPublicationState,
  resolveNewsReferenceUrl,
  topicMonth,
} from "./editorial";

const CONFIRM = "reclassify-legacy-video-intelligence-stories";
const CLEAR_INFERRED_AUTHORITY_CONFIRM = "clear-legacy-inferred-feed-authority";
const REFRESH_TOPIC_VISIBILITY_CONFIRM = "refresh-legacy-topic-visibility";
const REFRESH_NEWS_VISIBILITY_CONFIRM = "refresh-video-news-visibility-v1";
const MAX_BATCH = 50;

export const previewLegacyEditorialMigration = query({
  args: { cursor: v.union(v.string(), v.null()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("videoIntelligenceStories")
      .withIndex("by_updatedAtMs")
      .order("asc")
      .paginate({ cursor: args.cursor, numItems: boundedLimit(args.limit) });
    return {
      scanned: rows.page.length,
      pending: rows.page.filter((row) => !row.classification).length,
      legacyUnreviewed: rows.page.filter((row) => row.editorialStatus === "legacy_unreviewed")
        .length,
      continueCursor: rows.continueCursor,
      isDone: rows.isDone,
    };
  },
});

export const reclassifyLegacyEditorialBatch = mutation({
  args: {
    confirm: v.string(),
    cursor: v.union(v.string(), v.null()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (args.confirm !== CONFIRM) throw new Error("editorial_migration_not_confirmed");
    const rows = await ctx.db
      .query("videoIntelligenceStories")
      .withIndex("by_updatedAtMs")
      .order("asc")
      .paginate({ cursor: args.cursor, numItems: boundedLimit(args.limit) });
    let reclassified = 0;
    let coverageCreated = 0;
    let revisionsCreated = 0;
    for (const story of rows.page) {
      if (story.classification) continue;
      await ctx.db.patch(story._id, {
        classification: "dossier_only",
        editorialStatus: "legacy_unreviewed",
        visibleInNews: false,
      });
      reclassified += 1;
      const day = timelineDayFromValue(story.eventDate, story.updatedAtMs);
      const month = topicMonth(day);
      if (!month) continue;
      const contributions = await ctx.db
        .query("videoIntelligenceContributions")
        .withIndex("by_storyId", (q) => q.eq("storyId", story._id))
        .collect();
      for (const contribution of contributions) {
        const revision = await ensureLegacyRevision(ctx, contribution.dossierId, story.updatedAtMs);
        if (revision.created) revisionsCreated += 1;
        if (!contribution.revisionId) {
          await ctx.db.patch(contribution._id, {
            revisionId: revision.id,
            ...(revision.sourceAuthorityKey
              ? { sourceAuthorityKey: revision.sourceAuthorityKey }
              : {}),
          });
        }
        for (const tagId of story.tagIds) {
          const tag = await ctx.db.get(tagId);
          if (!tag) continue;
          const topic = await findOrCreateTopic(
            ctx,
            month,
            tag.normalizedKey,
            tag.canonicalName,
            story.updatedAtMs,
          );
          await ctx.db.insert("videoIntelligenceTopicCoverage", {
            topicId: topic,
            dossierId: contribution.dossierId,
            revisionId: revision.id,
            contributionId: contribution._id,
            sourceAuthorityKey: revision.sourceAuthorityKey,
            summary: contribution.summary,
            frame: contribution.frame,
            timelineDay: day,
            createdAtMs: story.updatedAtMs,
          });
          coverageCreated += 1;
        }
      }
    }
    return {
      scanned: rows.page.length,
      reclassified,
      coverageCreated,
      revisionsCreated,
      continueCursor: rows.continueCursor,
      isDone: rows.isDone,
    };
  },
});

/** Repairs early development batches that incorrectly promoted receipt provenance to authority. */
export const clearInferredLegacyFeedAuthorities = mutation({
  args: {
    confirm: v.string(),
    cursor: v.union(v.string(), v.null()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (args.confirm !== CLEAR_INFERRED_AUTHORITY_CONFIRM) {
      throw new Error("legacy_authority_clear_not_confirmed");
    }
    const revisions = await ctx.db
      .query("videoIntelligenceAnalysisRevisions")
      .withIndex("by_lifecycle_createdAtMs")
      .order("asc")
      .paginate({ cursor: args.cursor, numItems: boundedLimit(args.limit) });
    let revisionsCleared = 0;
    let contributionsCleared = 0;
    for (const revision of revisions.page) {
      if (!revision.sourceAuthorityKey?.startsWith("feed:")) continue;
      await ctx.db.patch(revision._id, { sourceAuthorityKey: undefined });
      revisionsCleared += 1;
      const contributions = await ctx.db
        .query("videoIntelligenceContributions")
        .withIndex("by_revisionId", (q) => q.eq("revisionId", revision._id))
        .collect();
      for (const contribution of contributions) {
        if (!contribution.sourceAuthorityKey?.startsWith("feed:")) continue;
        await ctx.db.patch(contribution._id, { sourceAuthorityKey: undefined });
        contributionsCleared += 1;
      }
    }
    return {
      revisionsCleared,
      contributionsCleared,
      continueCursor: revisions.continueCursor,
      isDone: revisions.isDone,
    };
  },
});

/** Backfills the paged-read predicate without changing retained coverage rows. */
export const refreshLegacyTopicVisibility = mutation({
  args: {
    confirm: v.string(),
    cursor: v.union(v.string(), v.null()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (args.confirm !== REFRESH_TOPIC_VISIBILITY_CONFIRM) {
      throw new Error("topic_visibility_refresh_not_confirmed");
    }
    const topics = await ctx.db
      .query("videoIntelligenceTopics")
      .withIndex("by_month_updatedAtMs")
      .order("asc")
      .paginate({ cursor: args.cursor, numItems: boundedLimit(args.limit) });
    let visible = 0;
    for (const topic of topics.page) {
      const coverage = await ctx.db
        .query("videoIntelligenceTopicCoverage")
        .withIndex("by_topicId_createdAtMs", (q) => q.eq("topicId", topic._id))
        .collect();
      let hasCurrentCoverage = false;
      for (const item of coverage) {
        if (!item.revisionId) continue;
        const revision = await ctx.db.get(item.revisionId);
        if (hasCurrentRevision(revision ? [revision.lifecycle] : [])) {
          hasCurrentCoverage = true;
          break;
        }
      }
      if (hasCurrentCoverage) visible += 1;
      await ctx.db.patch(topic._id, {
        visibleInTopics: hasCurrentCoverage,
        updatedAtMs: Date.now(),
      });
    }
    return { visible, continueCursor: topics.continueCursor, isDone: topics.isDone };
  },
});

export const previewNewsVisibilityRepair = query({
  args: { cursor: v.union(v.string(), v.null()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const stories = await ctx.db
      .query("videoIntelligenceStories")
      .withIndex("by_updatedAtMs")
      .order("asc")
      .paginate({ cursor: args.cursor, numItems: boundedLimit(args.limit) });
    let pending = 0;
    for (const story of stories.page) {
      const desired = await desiredNewsPublicationState(ctx, story);
      if (!desired) continue;
      if (
        story.classification !== desired.classification ||
        story.editorialStatus !== desired.editorialStatus ||
        story.visibleInNews !== desired.visibleInNews
      ) {
        pending += 1;
      }
    }
    return {
      scanned: stories.page.length,
      pending,
      continueCursor: stories.continueCursor,
      isDone: stories.isDone,
    };
  },
});

export const refreshNewsVisibilityBatch = mutation({
  args: {
    confirm: v.string(),
    cursor: v.union(v.string(), v.null()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (args.confirm !== REFRESH_NEWS_VISIBILITY_CONFIRM) {
      throw new Error("news_visibility_refresh_not_confirmed");
    }
    const stories = await ctx.db
      .query("videoIntelligenceStories")
      .withIndex("by_updatedAtMs")
      .order("asc")
      .paginate({ cursor: args.cursor, numItems: boundedLimit(args.limit) });
    let updated = 0;
    for (const story of stories.page) {
      const desired = await desiredNewsPublicationState(ctx, story);
      if (!desired) continue;
      if (
        story.classification === desired.classification &&
        story.editorialStatus === desired.editorialStatus &&
        story.visibleInNews === desired.visibleInNews
      ) {
        continue;
      }
      await ctx.db.patch(story._id, { ...desired, updatedAtMs: Date.now() });
      updated += 1;
    }
    return {
      scanned: stories.page.length,
      updated,
      continueCursor: stories.continueCursor,
      isDone: stories.isDone,
    };
  },
});

async function desiredNewsPublicationState(
  ctx: Pick<QueryCtx, "db">,
  story: Doc<"videoIntelligenceStories">,
) {
  const contributions = await ctx.db
    .query("videoIntelligenceContributions")
    .withIndex("by_storyId", (q) => q.eq("storyId", story._id))
    .collect();
  const authorities = new Set<string>();
  let hasCurrentCitedContribution = false;
  for (const contribution of contributions) {
    if (!contribution.revisionId) continue;
    const revision = await ctx.db.get(contribution.revisionId);
    if (
      revision?.lifecycle !== "current" ||
      !resolveNewsReferenceUrl(story.eventKey, contribution.claims)
    ) {
      continue;
    }
    hasCurrentCitedContribution = true;
    const authority = contribution.sourceAuthorityKey ?? revision.sourceAuthorityKey;
    if (authority) authorities.add(authority);
  }
  return hasCurrentCitedContribution ? newsPublicationState(true, authorities.size) : null;
}

async function ensureLegacyRevision(
  ctx: MutationCtx,
  dossierId: Id<"videoIntelligenceDossiers">,
  createdAtMs: number,
) {
  const existing = await ctx.db
    .query("videoIntelligenceAnalysisRevisions")
    .withIndex("by_dossier_lifecycle", (q) =>
      q.eq("dossierId", dossierId).eq("lifecycle", "current"),
    )
    .first();
  if (existing)
    return { id: existing._id, created: false, sourceAuthorityKey: existing.sourceAuthorityKey };
  // A Feed Scout receipt proves discovery provenance, not who produced this
  // historical analysis. Preserve it with authority intentionally unset.
  const sourceAuthorityKey: string | undefined = undefined;
  const id = await ctx.db.insert("videoIntelligenceAnalysisRevisions", {
    dossierId,
    revisionNumber: 1,
    lifecycle: "current",
    sourceAuthorityKey,
    createdAtMs,
  });
  return { id, created: true, sourceAuthorityKey };
}

async function findOrCreateTopic(
  ctx: MutationCtx,
  month: string,
  normalizedKey: string,
  title: string,
  now: number,
) {
  const existing = await ctx.db
    .query("videoIntelligenceTopics")
    .withIndex("by_month_normalizedKey", (q) =>
      q.eq("month", month).eq("normalizedKey", normalizeTagKey(normalizedKey)),
    )
    .first();
  if (existing) return existing._id;
  return await ctx.db.insert("videoIntelligenceTopics", {
    month,
    normalizedKey: normalizeTagKey(normalizedKey),
    title,
    visibleInTopics: false,
    createdAtMs: now,
    updatedAtMs: now,
  });
}

function boundedLimit(value: number | undefined): number {
  return Math.max(1, Math.min(Math.floor(value ?? MAX_BATCH), MAX_BATCH));
}
