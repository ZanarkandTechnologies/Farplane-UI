/** Shared content source/job helpers. New writers must use this layer, not Resource Bank jobs. */
import type { Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { canonicalizeContentRef } from "./identifiers";
import { timelineDayFromValue } from "./timeline";

export type ContentDbCtx = Pick<MutationCtx | QueryCtx, "db">;
type ContentMutationCtx = Pick<MutationCtx, "db">;

export function canonicalContentRef(sourceRef: string): string {
  return canonicalizeContentRef(sourceRef);
}

export async function ensureContentSource(
  ctx: ContentMutationCtx,
  input: {
    sourceKind: "url" | "image" | "video" | "audio" | "file" | "note" | "screenshot" | "clip";
    sourceRef: string;
    canonicalRef?: string;
    title?: string;
    platform?: string;
    youtubeChannelId?: string;
    sourcePrivacy: "public" | "local" | "private" | "unknown";
    now: number;
    timelineDay?: string;
  },
): Promise<Id<"contentSources">> {
  const canonicalRef = canonicalContentRef(input.canonicalRef ?? input.sourceRef);
  const existing = await ctx.db
    .query("contentSources")
    .withIndex("by_canonicalRef", (q) => q.eq("canonicalRef", canonicalRef))
    .first();
  if (existing) {
    await ctx.db.patch(existing._id, {
      ...(input.title ? { title: input.title } : {}),
      ...(input.platform ? { platform: input.platform } : {}),
      ...(input.youtubeChannelId && !existing.youtubeChannelId
        ? { youtubeChannelId: input.youtubeChannelId }
        : {}),
      ...(existing.timelineDay
        ? {}
        : { timelineDay: timelineDayFromValue(input.timelineDay, input.now) }),
      updatedAtMs: input.now,
    });
    return existing._id;
  }
  return await ctx.db.insert("contentSources", {
    sourceKind: input.sourceKind,
    sourceRef: input.sourceRef.trim().replace(/\s+/g, " ").slice(0, 2_000),
    canonicalRef,
    ...(input.title ? { title: input.title } : {}),
    ...(input.platform ? { platform: input.platform } : {}),
    ...(input.youtubeChannelId ? { youtubeChannelId: input.youtubeChannelId } : {}),
    sourcePrivacy: input.sourcePrivacy,
    timelineDay: timelineDayFromValue(input.timelineDay, input.now),
    createdAtMs: input.now,
    updatedAtMs: input.now,
  });
}

export async function getContentJobOrThrow(ctx: ContentDbCtx, jobId: Id<"contentJobs">) {
  const job = await ctx.db.get(jobId);
  if (!job) throw new Error("content_job_not_found");
  return job;
}
