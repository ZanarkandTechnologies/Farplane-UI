/** Authenticated curation of Topic → World Markdown links; World remains read-only here. */
import { v } from "convex/values";
import { mutation } from "../../_generated/server";
import { isCuratedWorldMarkdown } from "./editorial";

export const setTopicWorldReference = mutation({
  args: {
    topicId: v.id("videoIntelligenceTopics"),
    curatedWorldMarkdown: v.union(v.string(), v.null()),
  },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("topic_curation_auth_required");
    if (args.curatedWorldMarkdown && !isCuratedWorldMarkdown(args.curatedWorldMarkdown)) {
      throw new Error("topic_world_reference_invalid");
    }
    const topic = await ctx.db.get(args.topicId);
    if (!topic) throw new Error("topic_not_found");
    await ctx.db.patch(topic._id, {
      curatedWorldMarkdown: args.curatedWorldMarkdown ?? undefined,
      updatedAtMs: Date.now(),
    });
    return { ok: true };
  },
});
