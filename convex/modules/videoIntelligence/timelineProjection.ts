/** Indexed one-day timeline and selected-detail reads for Video Intelligence. */
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc } from "../../_generated/dataModel";
import type { QueryCtx } from "../../_generated/server";
import { query } from "../../_generated/server";
import { isTimelineDay } from "../content/timeline";
import { resolveNewsReferenceUrl } from "./editorial";

const directionValidator = v.union(v.literal("latest"), v.literal("older"), v.literal("newer"));

export const getVideoTimelineAnchor = query({
  args: { direction: directionValidator, day: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.direction !== "latest" && (!args.day || !isTimelineDay(args.day))) {
      throw new Error("video_timeline_anchor_day_invalid");
    }
    const requestedDay = args.day;
    const dossier =
      args.direction === "latest"
        ? await ctx.db
            .query("videoIntelligenceDossiers")
            .withIndex("by_timelineDay_updatedAtMs")
            .order("desc")
            .first()
        : args.direction === "older"
          ? await ctx.db
              .query("videoIntelligenceDossiers")
              .withIndex("by_timelineDay_updatedAtMs", (q) =>
                q.lt("timelineDay", requestedDay ?? ""),
              )
              .order("desc")
              .first()
          : await ctx.db
              .query("videoIntelligenceDossiers")
              .withIndex("by_timelineDay_updatedAtMs", (q) =>
                q.gt("timelineDay", requestedDay ?? ""),
              )
              .order("asc")
              .first();
    return dossier?.timelineDay ?? null;
  },
});

export const getVideoItemsForDay = query({
  args: { day: v.string(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    if (!isTimelineDay(args.day)) throw new Error("video_timeline_day_invalid");
    const result = await ctx.db
      .query("videoIntelligenceDossiers")
      .withIndex("by_timelineDay_updatedAtMs", (q) => q.eq("timelineDay", args.day))
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      ...result,
      page: await Promise.all(result.page.map((dossier) => toVideoItem(ctx, dossier))),
    };
  },
});

export const getStoryTimelineAnchor = query({
  args: { direction: directionValidator, day: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.direction !== "latest" && (!args.day || !isTimelineDay(args.day))) {
      throw new Error("story_timeline_anchor_day_invalid");
    }
    const requestedDay = args.day;
    const story =
      args.direction === "latest"
        ? await ctx.db
            .query("videoIntelligenceStories")
            .withIndex("by_timelineDay_updatedAtMs")
            .order("desc")
            .first()
        : args.direction === "older"
          ? await ctx.db
              .query("videoIntelligenceStories")
              .withIndex("by_timelineDay_updatedAtMs", (q) =>
                q.lt("timelineDay", requestedDay ?? ""),
              )
              .order("desc")
              .first()
          : await ctx.db
              .query("videoIntelligenceStories")
              .withIndex("by_timelineDay_updatedAtMs", (q) =>
                q.gt("timelineDay", requestedDay ?? ""),
              )
              .order("asc")
              .first();
    return story?.timelineDay ?? null;
  },
});

export const getStoryItemsForDay = query({
  args: { day: v.string(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    if (!isTimelineDay(args.day)) throw new Error("story_timeline_day_invalid");
    const result = await ctx.db
      .query("videoIntelligenceStories")
      .withIndex("by_timelineDay_updatedAtMs", (q) => q.eq("timelineDay", args.day))
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      ...result,
      page: await Promise.all(result.page.map((story) => toStoryItem(ctx, story))),
    };
  },
});

export const getVideoDossierDetail = query({
  args: { dossierId: v.id("videoIntelligenceDossiers") },
  handler: async (ctx, args) => {
    const dossier = await ctx.db.get(args.dossierId);
    return dossier ? await toDossierDetail(ctx, dossier) : null;
  },
});

export const getVideoStoryDetail = query({
  args: { storyId: v.id("videoIntelligenceStories") },
  handler: async (ctx, args) => {
    const story = await ctx.db.get(args.storyId);
    if (!story) return null;
    const [tags, storedContributions] = await Promise.all([
      Promise.all(story.tagIds.map((tagId) => ctx.db.get(tagId))),
      ctx.db
        .query("videoIntelligenceContributions")
        .withIndex("by_storyId", (q) => q.eq("storyId", story._id))
        .take(100),
    ]);
    const contributions = await currentContributions(ctx, storedContributions);
    return {
      id: String(story._id),
      title: story.title,
      summary: story.summary,
      eventDate: story.eventDate ?? null,
      timelineDay: story.timelineDay ?? null,
      entities: story.entities,
      tags: tags.flatMap((tag) => (tag ? [{ id: String(tag._id), name: tag.canonicalName }] : [])),
      contributions: await Promise.all(
        contributions.map(async (contribution) => {
          const dossier = await ctx.db.get(contribution.dossierId);
          const contentSource = dossier?.contentSourceId
            ? await ctx.db.get(dossier.contentSourceId)
            : null;
          return {
            id: String(contribution._id),
            dossierId: String(contribution.dossierId),
            frame: contribution.frame,
            summary: contribution.summary,
            claimCount: contribution.claims.length,
            source: dossier
              ? {
                  title: contentSource?.title ?? dossier.videoId,
                  publisher: dossier.publisher ?? null,
                  publishedAt: dossier.publishedAt ?? null,
                }
              : null,
          };
        }),
      ),
    };
  },
});

async function toVideoItem(ctx: QueryCtx, dossier: Doc<"videoIntelligenceDossiers">) {
  const [source, storedContributions] = await Promise.all([
    dossier.contentSourceId ? ctx.db.get(dossier.contentSourceId) : null,
    ctx.db
      .query("videoIntelligenceContributions")
      .withIndex("by_dossierId", (q) => q.eq("dossierId", dossier._id))
      .take(100),
  ]);
  const contributions = await currentContributions(ctx, storedContributions);
  return {
    id: String(dossier._id),
    videoId: dossier.videoId,
    title: source?.title ?? dossier.videoId,
    canonicalUrl: source?.canonicalRef ?? `https://www.youtube.com/watch?v=${dossier.videoId}`,
    publisher: dossier.publisher ?? null,
    sourceStatus: dossier.sourceStatus,
    timelineDay: dossier.timelineDay ?? null,
    summary: dossier.summary,
    storyCount: new Set(contributions.map((item) => String(item.storyId))).size,
    updatedAt: new Date(dossier.updatedAtMs).toISOString(),
  };
}

async function toStoryItem(ctx: QueryCtx, story: Doc<"videoIntelligenceStories">) {
  const [tags, contributions] = await Promise.all([
    Promise.all(story.tagIds.map((tagId) => ctx.db.get(tagId))),
    ctx.db
      .query("videoIntelligenceContributions")
      .withIndex("by_storyId", (q) => q.eq("storyId", story._id))
      .take(100),
  ]);
  return {
    id: String(story._id),
    title: story.title,
    summary: story.summary,
    eventDate: story.eventDate ?? null,
    timelineDay: story.timelineDay ?? null,
    entities: story.entities,
    tags: tags.flatMap((tag) => (tag ? [{ id: String(tag._id), name: tag.canonicalName }] : [])),
    sourceCount: new Set(contributions.map((item) => String(item.dossierId))).size,
  };
}

async function toDossierDetail(ctx: QueryCtx, dossier: Doc<"videoIntelligenceDossiers">) {
  const [source, storedContributions] = await Promise.all([
    dossier.contentSourceId ? ctx.db.get(dossier.contentSourceId) : null,
    ctx.db
      .query("videoIntelligenceContributions")
      .withIndex("by_dossierId", (q) => q.eq("dossierId", dossier._id))
      .take(100),
  ]);
  const contributions = await currentContributions(ctx, storedContributions);
  const stories = await Promise.all(
    contributions.map(async (contribution) => {
      const story = await ctx.db.get(contribution.storyId);
      const referenceUrl = story
        ? resolveNewsReferenceUrl(story.eventKey, contribution.claims)
        : null;
      return story
        ? {
            id: String(story._id),
            title: story.title,
            eventDate: story.eventDate ?? null,
            referenceUrl,
          }
        : null;
    }),
  );
  return {
    id: String(dossier._id),
    videoId: dossier.videoId,
    canonicalUrl: source?.canonicalRef ?? `https://www.youtube.com/watch?v=${dossier.videoId}`,
    title: source?.title ?? dossier.videoId,
    publisher: dossier.publisher ?? null,
    publishedAt: dossier.publishedAt ?? null,
    sourceStatus: dossier.sourceStatus,
    sourceNote: dossier.sourceNote,
    timelineDay: dossier.timelineDay ?? null,
    summary: dossier.summary,
    concepts: dossier.concepts ?? [],
    keyPoints: dossier.keyPoints,
    stories: stories.filter((story): story is NonNullable<typeof story> =>
      Boolean(story?.referenceUrl),
    ),
  };
}

async function currentContributions(
  ctx: QueryCtx,
  contributions: Doc<"videoIntelligenceContributions">[],
) {
  const rows = await Promise.all(
    contributions.map(async (contribution) => ({
      contribution,
      revision: contribution.revisionId ? await ctx.db.get(contribution.revisionId) : null,
    })),
  );
  return rows.flatMap(({ contribution, revision }) =>
    !contribution.revisionId || revision?.lifecycle === "current" ? [contribution] : [],
  );
}
