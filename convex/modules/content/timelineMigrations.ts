/** Confirmation-gated, cursor-based timeline-day backfill for Content sources. */
import { v } from "convex/values";
import type { QueryCtx } from "../../_generated/server";
import { mutation, query } from "../../_generated/server";
import { timelineDayFromValue } from "./timeline";

const CONFIRM = "backfill-content-timeline-days";
const MAX_BATCH = 100;

export const previewContentTimelineBackfill = query({
  args: { cursor: v.union(v.string(), v.null()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => inspectPage(ctx, args.cursor, boundedLimit(args.limit)),
});

export const backfillContentTimelineBatch = mutation({
  args: {
    confirm: v.string(),
    cursor: v.union(v.string(), v.null()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (args.confirm !== CONFIRM) throw new Error("content_timeline_backfill_not_confirmed");
    const page = await ctx.db
      .query("contentSources")
      .withIndex("by_updatedAtMs")
      .order("asc")
      .paginate({ cursor: args.cursor, numItems: boundedLimit(args.limit) });
    let updated = 0;
    for (const source of page.page) {
      if (source.timelineDay) continue;
      const latestDiscovery = await ctx.db
        .query("contentDiscoveries")
        .withIndex("by_source_observedDate", (q) => q.eq("contentSourceId", source._id))
        .order("desc")
        .first();
      await ctx.db.patch(source._id, {
        timelineDay: timelineDayFromValue(latestDiscovery?.observedDate, source.updatedAtMs),
      });
      updated += 1;
    }
    return { updated, continueCursor: page.continueCursor, isDone: page.isDone };
  },
});

async function inspectPage(ctx: QueryCtx, cursor: string | null, limit: number) {
  const page = await ctx.db
    .query("contentSources")
    .withIndex("by_updatedAtMs")
    .order("asc")
    .paginate({ cursor, numItems: limit });
  return {
    scanned: page.page.length,
    pending: page.page.filter((source) => !source.timelineDay).length,
    continueCursor: page.continueCursor,
    isDone: page.isDone,
  };
}

function boundedLimit(value: number | undefined): number {
  return Math.max(1, Math.min(Math.floor(value ?? MAX_BATCH), MAX_BATCH));
}
