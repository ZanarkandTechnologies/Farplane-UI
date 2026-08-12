/**
 * Feed Scout intake writer.
 * A source-level intake job marks import completion; daily discoveries retain repeatable provenance.
 */
import { v } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import { mutation } from "../../_generated/server";
import { canonicalContentRef, ensureContentSource } from "./records";
import { isTimelineDay, timelineDayFromValue } from "./timeline";

const sourceKind = v.union(
  v.literal("url"),
  v.literal("image"),
  v.literal("video"),
  v.literal("audio"),
  v.literal("file"),
  v.literal("note"),
  v.literal("screenshot"),
  v.literal("clip"),
);

export const importFeedScoutItem = mutation({
  args: {
    sourceKind,
    sourceRef: v.string(),
    title: v.string(),
    platform: v.string(),
    summary: v.optional(v.string()),
    feedScopeKey: v.string(),
    observedDate: v.string(),
    externalKey: v.string(),
    entityGroupId: v.string(),
    feedSourceId: v.string(),
    evidenceRefs: v.array(v.string()),
    tags: v.array(v.string()),
    publishedAt: v.optional(v.string()),
    discoveredAt: v.optional(v.string()),
    contentProjectId: v.optional(v.string()),
  },
  returns: v.object({
    sourceId: v.id("contentSources"),
    intakeJobId: v.id("contentJobs"),
    discoveryId: v.id("contentDiscoveries"),
    sourceCreated: v.boolean(),
    intakeJobCreated: v.boolean(),
    discoveryCreated: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const sourceRef = requireText(args.sourceRef, "feed_scout_source_ref", 2_000);
    const canonicalRef = canonicalContentRef(sourceRef);
    const title = requireText(args.title, "feed_scout_title", 300);
    const platform = requireText(args.platform, "feed_scout_platform", 120);
    const feedScopeKey = requireText(args.feedScopeKey, "feed_scout_scope", 2_000);
    const observedDate = requireFeedScoutObservedDate(args.observedDate);
    const externalKey = requireText(args.externalKey, "feed_scout_external_key", 300);
    const entityGroupId = requireText(args.entityGroupId, "feed_scout_entity_group", 300);
    const feedSourceId = requireText(args.feedSourceId, "feed_scout_source", 300);
    const summary = optionalText(args.summary, 3_000);
    const contentProjectId = optionalText(args.contentProjectId, 120);
    const evidenceRefs = cleanList(args.evidenceRefs, 1_000, 40);
    const tags = cleanList(args.tags, 120, 30);
    const publishedAt = optionalIsoTimestamp(args.publishedAt, "feed_scout_published_at");
    const discoveredAt = optionalIsoTimestamp(args.discoveredAt, "feed_scout_discovered_at");

    const existingSource = await ctx.db
      .query("contentSources")
      .withIndex("by_canonicalRef", (q) => q.eq("canonicalRef", canonicalRef))
      .first();
    const sourceId = await ensureContentSource(ctx, {
      sourceKind: args.sourceKind,
      sourceRef,
      canonicalRef,
      title,
      platform,
      sourcePrivacy: "public",
      now,
      timelineDay: observedDate,
    });
    const source = await ctx.db.get(sourceId);
    if (!source) throw new Error("feed_scout_source_missing");
    if (!source.timelineDay || observedDate > source.timelineDay) {
      await ctx.db.patch(sourceId, {
        timelineDay: timelineDayFromValue(observedDate, now),
        updatedAtMs: now,
      });
    }
    const existingIntakeJob = await ctx.db
      .query("contentJobs")
      .withIndex("by_source_kind_createdAtMs", (q) =>
        q.eq("sourceId", sourceId).eq("kind", "ingest_feed_scout"),
      )
      .first();
    const intakeJobId = existingIntakeJob
      ? existingIntakeJob._id
      : await ctx.db.insert("contentJobs", {
          sourceId,
          kind: "ingest_feed_scout",
          requestedFocus: "Feed Scout intake",
          tags: ["feed-scout", ...tags],
          projectId: contentProjectId,
          requestedBy: "farplane-ui-content-sync-feed-scout",
          status: "ready",
          createdAtMs: now,
          updatedAtMs: now,
          completedAtMs: now,
        });
    if (existingIntakeJob && contentProjectId && !existingIntakeJob.projectId) {
      await ctx.db.patch(existingIntakeJob._id, { projectId: contentProjectId, updatedAtMs: now });
    }

    const existingDiscovery = await ctx.db
      .query("contentDiscoveries")
      .withIndex("by_receipt", (q) =>
        q
          .eq("contentSourceId", sourceId)
          .eq("origin", "feed_scout")
          .eq("feedScopeKey", feedScopeKey)
          .eq("observedDate", observedDate)
          .eq("externalKey", externalKey),
      )
      .first();
    const discoveryFields = {
      contentSourceId: sourceId,
      origin: "feed_scout" as const,
      feedScopeKey,
      observedDate,
      externalKey,
      entityGroupId,
      feedSourceId,
      title,
      summary,
      platform,
      publishedAt,
      discoveredAt,
      evidenceRefs,
      tags,
      contentProjectId,
      updatedAtMs: now,
    };
    let discoveryId: Id<"contentDiscoveries">;
    if (existingDiscovery) {
      await ctx.db.patch(existingDiscovery._id, discoveryFields);
      discoveryId = existingDiscovery._id;
    } else {
      discoveryId = await ctx.db.insert("contentDiscoveries", {
        ...discoveryFields,
        createdAtMs: now,
      });
    }

    return {
      sourceId,
      intakeJobId,
      discoveryId,
      sourceCreated: !existingSource,
      intakeJobCreated: !existingIntakeJob,
      discoveryCreated: !existingDiscovery,
    };
  },
});

function requireText(value: string, code: string, max: number): string {
  const cleaned = optionalText(value, max);
  if (!cleaned) throw new Error(code);
  return cleaned;
}

function optionalText(value: string | undefined, max: number): string | undefined {
  const cleaned = value?.trim().replace(/\s+/g, " ").slice(0, max);
  return cleaned || undefined;
}

function cleanList(values: string[], max: number, limit: number): string[] {
  return [
    ...new Set(values.map((value) => optionalText(value, max)).filter(Boolean) as string[]),
  ].slice(0, limit);
}

export function requireFeedScoutObservedDate(value: string): string {
  const cleaned = requireText(value, "feed_scout_observed_date", 10);
  if (!isTimelineDay(cleaned)) throw new Error("feed_scout_observed_date");
  return cleaned;
}

function optionalIsoTimestamp(value: string | undefined, code: string): string | undefined {
  const cleaned = optionalText(value, 40);
  if (!cleaned) return undefined;
  if (!Number.isFinite(Date.parse(cleaned))) throw new Error(code);
  return cleaned;
}
