/**
 * Pre-watch novelty for dossiers analyzed before the YouTube bridge compared key points with the
 * creator's Wiki page. An agent judges each key point against that page (the intelligest skill's
 * pre-watch-novelty reference) and this confirmation-gated mutation stores the verdicts the way new
 * analyses carry them: a `[NEW]`, `[EXTENDS]` or `[RESTATED]` prefix on each finding. Nothing else
 * changes: not the finding text, the analysis time, nor the revision. A dossier re-analyzed since the
 * judgment (another `updatedAtMs`) is refused.
 */
import { type Infer, v } from "convex/values";
import { mutation } from "../../_generated/server";

const CONFIRM = "tag-video-intelligence-key-point-novelty";
const MAX_BATCH = 25;
const TAG = /^\s*\[(NEW|EXTENDS|RESTATED)\]\s*/i;

const noveltyValidator = v.union(v.literal("NEW"), v.literal("EXTENDS"), v.literal("RESTATED"));
export type KeyPointNovelty = Infer<typeof noveltyValidator>;

/** Each finding with its verdict in front, replacing any earlier verdict. One verdict per key point. */
export function tagFindings<T extends { finding: string }>(keyPoints: T[], novelty: KeyPointNovelty[]): T[] {
  if (novelty.length !== keyPoints.length) throw new Error("video_intelligence_novelty_count_mismatch");
  return keyPoints.map((point, index) => ({
    ...point,
    finding: `[${novelty[index]}] ${point.finding.replace(TAG, "")}`,
  }));
}

export const tagKeyPointNovelty = mutation({
  args: {
    confirm: v.string(),
    items: v.array(
      v.object({
        dossierId: v.id("videoIntelligenceDossiers"),
        /** The dossier's `updatedAtMs` when its key points were judged. */
        analyzedAtMs: v.number(),
        novelty: v.array(noveltyValidator),
      }),
    ),
  },
  returns: v.object({ tagged: v.number() }),
  handler: async (ctx, args) => {
    if (args.confirm !== CONFIRM) throw new Error("video_intelligence_novelty_not_confirmed");
    if (args.items.length > MAX_BATCH) throw new Error("video_intelligence_novelty_batch_too_large");
    for (const item of args.items) {
      const dossier = await ctx.db.get(item.dossierId);
      if (!dossier) throw new Error("video_intelligence_dossier_missing");
      if (dossier.updatedAtMs !== item.analyzedAtMs) throw new Error("video_intelligence_dossier_reanalyzed");
      await ctx.db.patch(item.dossierId, { keyPoints: tagFindings(dossier.keyPoints, item.novelty) });
    }
    return { tagged: args.items.length };
  },
});
