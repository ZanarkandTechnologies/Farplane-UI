// Resource Bank actions for vector search, which Convex exposes only from actions.
import { v } from "convex/values";
import { action } from "../../_generated/server";
import { clampLimit } from "./resourceBank";
import { findSimilarAssetsArgsValidator } from "./validators";

export const findSimilarAssets = action({
  args: findSimilarAssetsArgsValidator,
  returns: v.object({
    results: v.array(
      v.object({
        analysisId: v.id("resourceBankAnalyses"),
        score: v.number(),
      }),
    ),
    note: v.string(),
  }),
  handler: async (ctx, args) => {
    const limit = clampLimit(args.limit, 12, 40);
    const results = await ctx.vectorSearch("resourceBankAnalyses", "by_embedding", {
      vector: args.embedding,
      limit,
      filter: args.projectId
        ? (q) => q.eq("projectId", args.projectId)
        : args.taskId
          ? (q) => q.eq("taskId", args.taskId)
          : undefined,
    });
    return {
      results: results.map((result) => ({
        analysisId: result._id,
        score: result._score,
      })),
      note: "Vector search returns analysis ids and scores; load asset details with getResourceAsset after resolving the analysis rows.",
    };
  },
});
