/** Confirmation-gated, cursor-based date-key backfill for dossiers and Stories. */
import { v } from "convex/values";
import { mutation, query } from "../../_generated/server";
import { timelineDayFromMs, timelineDayFromValue } from "../content/timeline";

const CONFIRM = "backfill-video-intelligence-timeline-days";
const MAX_BATCH = 100;

export const previewVideoDossierTimelineBackfill = query({
  args: { cursor: v.union(v.string(), v.null()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const dossiers = await ctx.db
      .query("videoIntelligenceDossiers")
      .withIndex("by_updatedAtMs")
      .order("asc")
      .paginate({ cursor: args.cursor, numItems: boundedLimit(args.limit) });
    return {
      scanned: dossiers.page.length,
      pending: dossiers.page.filter((item) => !item.timelineDay).length,
      continueCursor: dossiers.continueCursor,
      isDone: dossiers.isDone,
    };
  },
});

export const backfillVideoDossierTimelineBatch = mutation({
  args: {
    confirm: v.string(),
    cursor: v.union(v.string(), v.null()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (args.confirm !== CONFIRM) throw new Error("video_timeline_backfill_not_confirmed");
    const dossiers = await ctx.db
      .query("videoIntelligenceDossiers")
      .withIndex("by_updatedAtMs")
      .order("asc")
      .paginate({ cursor: args.cursor, numItems: boundedLimit(args.limit) });
    let updated = 0;
    for (const dossier of dossiers.page) {
      if (dossier.timelineDay) continue;
      await ctx.db.patch(dossier._id, { timelineDay: timelineDayFromMs(dossier.updatedAtMs) });
      updated += 1;
    }
    return {
      updated,
      continueCursor: dossiers.continueCursor,
      isDone: dossiers.isDone,
    };
  },
});

export const previewVideoStoryTimelineBackfill = query({
  args: { cursor: v.union(v.string(), v.null()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const stories = await ctx.db
      .query("videoIntelligenceStories")
      .withIndex("by_updatedAtMs")
      .order("asc")
      .paginate({ cursor: args.cursor, numItems: boundedLimit(args.limit) });
    return {
      scanned: stories.page.length,
      pending: stories.page.filter((item) => !item.timelineDay).length,
      continueCursor: stories.continueCursor,
      isDone: stories.isDone,
    };
  },
});

export const backfillVideoStoryTimelineBatch = mutation({
  args: {
    confirm: v.string(),
    cursor: v.union(v.string(), v.null()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (args.confirm !== CONFIRM) throw new Error("video_timeline_backfill_not_confirmed");
    const stories = await ctx.db
      .query("videoIntelligenceStories")
      .withIndex("by_updatedAtMs")
      .order("asc")
      .paginate({ cursor: args.cursor, numItems: boundedLimit(args.limit) });
    let updated = 0;
    for (const story of stories.page) {
      if (story.timelineDay) continue;
      await ctx.db.patch(story._id, {
        timelineDay: timelineDayFromValue(story.eventDate, story.updatedAtMs),
      });
      updated += 1;
    }
    return {
      updated,
      continueCursor: stories.continueCursor,
      isDone: stories.isDone,
    };
  },
});

function boundedLimit(value: number | undefined): number {
  return Math.max(1, Math.min(Math.floor(value ?? MAX_BATCH), MAX_BATCH));
}
