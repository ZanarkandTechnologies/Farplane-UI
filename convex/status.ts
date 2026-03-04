import { query } from "./_generated/server";
import { v } from "convex/values";

export const getAgentStatus = query({
  args: {
    agentId: v.string(),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("agentStatus")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .first();
  },
});

export const getMultipleAgentStatuses = query({
  args: {
    agentIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const rows = await Promise.all(
      args.agentIds.map((agentId) =>
        ctx.db
          .query("agentStatus")
          .withIndex("by_agent", (q) => q.eq("agentId", agentId))
          .first(),
      ),
    );

    return args.agentIds.reduce<Record<string, (typeof rows)[number]>>((acc, agentId, index) => {
      const row = rows[index];
      if (row) acc[agentId] = row;
      return acc;
    }, {});
  },
});

export const getAgentEvents = query({
  args: {
    agentId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 20, 1), 100);
    const rows = await ctx.db
      .query("agentEvents")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .order("desc")
      .take(limit);
    return rows;
  },
});
