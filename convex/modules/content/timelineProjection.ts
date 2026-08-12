/** Narrow, indexed read models for one Content Intelligence calendar day. */
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { query } from "../../_generated/server";
import { hydrateContentSource } from "./intelligenceProjection";
import { isTimelineDay } from "./timeline";

const directionValidator = v.union(v.literal("latest"), v.literal("older"), v.literal("newer"));

export const getContentTimelineAnchor = query({
  args: { direction: directionValidator, day: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.direction !== "latest" && (!args.day || !isTimelineDay(args.day))) {
      throw new Error("content_timeline_anchor_day_invalid");
    }
    const requestedDay = args.day;
    const row =
      args.direction === "latest"
        ? await ctx.db
            .query("contentSources")
            .withIndex("by_timelineDay_updatedAtMs")
            .order("desc")
            .first()
        : args.direction === "older"
          ? await ctx.db
              .query("contentSources")
              .withIndex("by_timelineDay_updatedAtMs", (q) =>
                q.lt("timelineDay", requestedDay ?? ""),
              )
              .order("desc")
              .first()
          : await ctx.db
              .query("contentSources")
              .withIndex("by_timelineDay_updatedAtMs", (q) =>
                q.gt("timelineDay", requestedDay ?? ""),
              )
              .order("asc")
              .first();
    return row?.timelineDay ?? null;
  },
});

export const getContentItemsForDay = query({
  args: { day: v.string(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    if (!isTimelineDay(args.day)) throw new Error("content_timeline_day_invalid");
    const sourcePage = await ctx.db
      .query("contentSources")
      .withIndex("by_timelineDay_updatedAtMs", (q) => q.eq("timelineDay", args.day))
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      ...sourcePage,
      page: await Promise.all(sourcePage.page.map((source) => hydrateContentSource(ctx, source))),
    };
  },
});

export const getContentItemDetail = query({
  args: { sourceId: v.id("contentSources") },
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceId);
    return source ? await hydrateContentSource(ctx, source) : null;
  },
});
