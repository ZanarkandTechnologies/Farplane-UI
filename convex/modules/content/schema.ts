/**
 * Content owns source identity and the shared lifecycle for saving or analyzing a source.
 * Resource Bank and Video Intelligence attach their domain records to `contentJobs`.
 */
import { defineTable } from "convex/server";
import { v } from "convex/values";

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

const sourcePrivacy = v.union(
  v.literal("public"),
  v.literal("local"),
  v.literal("private"),
  v.literal("unknown"),
);

const jobStatus = v.union(
  v.literal("queued"),
  v.literal("analyzing"),
  v.literal("ready"),
  v.literal("failed"),
  v.literal("needs_review"),
);

export const contentTables = {
  contentSources: defineTable({
    sourceKind,
    sourceRef: v.string(),
    canonicalRef: v.string(),
    title: v.optional(v.string()),
    platform: v.optional(v.string()),
    /** Strict page metadata; never used as mutable reporting authority. */
    youtubeChannelId: v.optional(v.string()),
    sourcePrivacy,
    /** Canonical UTC calendar day used by Content Intelligence's server pager. */
    timelineDay: v.optional(v.string()),
    createdAtMs: v.number(),
    updatedAtMs: v.number(),
  })
    .index("by_canonicalRef", ["canonicalRef"])
    .index("by_sourceRef", ["sourceRef"])
    .index("by_updatedAtMs", ["updatedAtMs"])
    .index("by_timelineDay_updatedAtMs", ["timelineDay", "updatedAtMs"]),

  contentJobs: defineTable({
    sourceId: v.id("contentSources"),
    kind: v.union(
      v.literal("save_reference"),
      v.literal("analyze_youtube"),
      v.literal("ingest_feed_scout"),
    ),
    originalInstruction: v.optional(v.string()),
    note: v.optional(v.string()),
    requestedFocus: v.optional(v.string()),
    brandKitId: v.optional(v.string()),
    sourceScope: v.optional(
      v.object({
        startMs: v.optional(v.number()),
        endMs: v.optional(v.number()),
        pageRange: v.optional(v.string()),
        regionLabel: v.optional(v.string()),
      }),
    ),
    tags: v.array(v.string()),
    projectId: v.optional(v.string()),
    taskId: v.optional(v.string()),
    externalTaskRef: v.optional(v.string()),
    requestedBy: v.optional(v.string()),
    status: jobStatus,
    error: v.optional(v.string()),
    createdAtMs: v.number(),
    updatedAtMs: v.number(),
    completedAtMs: v.optional(v.number()),
    legacyResourceBankJobId: v.optional(v.id("resourceBankIngestionJobs")),
  })
    .index("by_source", ["sourceId"])
    .index("by_source_kind_status", ["sourceId", "kind", "status"])
    .index("by_source_kind_createdAtMs", ["sourceId", "kind", "createdAtMs"])
    .index("by_kind_createdAtMs", ["kind", "createdAtMs"])
    .index("by_project_createdAtMs", ["projectId", "createdAtMs"])
    .index("by_legacyResourceBankJobId", ["legacyResourceBankJobId"]),

  contentDiscoveries: defineTable({
    contentSourceId: v.id("contentSources"),
    origin: v.literal("feed_scout"),
    feedScopeKey: v.string(),
    observedDate: v.string(),
    externalKey: v.string(),
    entityGroupId: v.string(),
    feedSourceId: v.string(),
    title: v.string(),
    summary: v.optional(v.string()),
    platform: v.string(),
    publishedAt: v.optional(v.string()),
    discoveredAt: v.optional(v.string()),
    evidenceRefs: v.array(v.string()),
    tags: v.array(v.string()),
    contentProjectId: v.optional(v.string()),
    createdAtMs: v.number(),
    updatedAtMs: v.number(),
  })
    .index("by_source", ["contentSourceId"])
    .index("by_source_observedDate", ["contentSourceId", "observedDate"])
    .index("by_receipt", [
      "contentSourceId",
      "origin",
      "feedScopeKey",
      "observedDate",
      "externalKey",
    ])
    .index("by_observedDate", ["observedDate"]),
};
