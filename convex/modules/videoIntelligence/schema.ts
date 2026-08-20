/** Video Intelligence tables extend Resource Bank videos with structured reporting relationships. */
import { defineTable } from "convex/server";
import { v } from "convex/values";
import {
  clickbaitValidator,
  comparisonReceiptValidator,
  comparisonRelationshipValidator,
  keyPointValidator,
  projectRelevanceValidator,
  recommendationValidator,
  reportingClaimValidator,
  sourceStatusValidator,
  tagProvenanceValidator,
} from "./validators";

const videoIntelligenceExecutionProfile = v.object({
  definition: v.literal("video_intelligence.analysis.v1"),
  model: v.string(),
  reasoningEffort: v.string(),
});

export const videoIntelligenceTables = {
  videoIntelligenceDossiers: defineTable({
    // Legacy Resource Bank links are retained only while the bounded cutover runs.
    resourceAssetId: v.optional(v.id("resourceBankAssets")),
    resourceJobId: v.optional(v.id("resourceBankIngestionJobs")),
    contentSourceId: v.optional(v.id("contentSources")),
    contentJobId: v.optional(v.id("contentJobs")),
    videoId: v.string(),
    /** Page-provenance only; reporting authority is immutable on a revision. */
    youtubeChannelId: v.optional(v.string()),
    threadId: v.string(),
    publisher: v.optional(v.string()),
    publishedAt: v.optional(v.string()),
    summary: v.string(),
    sourceStatus: sourceStatusValidator,
    sourceNote: v.string(),
    projectRelevance: v.array(projectRelevanceValidator),
    clickbait: clickbaitValidator,
    keyPoints: v.array(keyPointValidator),
    recommendation: recommendationValidator,
    /** Optional only for retained schema-v4 dossiers. */
    concepts: v.optional(v.array(v.string())),
    duplicateIngestCount: v.number(),
    /** UTC activity day; this is the Video Intelligence day-pager key. */
    timelineDay: v.optional(v.string()),
    createdAtMs: v.number(),
    updatedAtMs: v.number(),
  })
    .index("by_resourceAssetId", ["resourceAssetId"])
    .index("by_resourceJobId", ["resourceJobId"])
    .index("by_contentSourceId", ["contentSourceId"])
    .index("by_contentJobId", ["contentJobId"])
    .index("by_videoId", ["videoId"])
    .index("by_publishedAt", ["publishedAt"])
    .index("by_updatedAtMs", ["updatedAtMs"])
    .index("by_timelineDay_updatedAtMs", ["timelineDay", "updatedAtMs"]),

  videoIntelligenceStories: defineTable({
    title: v.string(),
    summary: v.string(),
    eventDate: v.optional(v.string()),
    eventKey: v.optional(v.string()),
    whyNow: v.optional(v.string()),
    whyItMatters: v.optional(v.string()),
    entities: v.array(v.string()),
    tagIds: v.array(v.id("videoIntelligenceTags")),
    status: v.literal("provisional"),
    classification: v.optional(
      v.union(v.literal("dossier_only"), v.literal("topic_coverage"), v.literal("news")),
    ),
    editorialStatus: v.optional(
      v.union(v.literal("legacy_unreviewed"), v.literal("developing"), v.literal("aggregated")),
    ),
    /** Materialized current-revision predicate for paged News reads. */
    visibleInNews: v.optional(v.boolean()),
    /** Exact event day when present, otherwise the writer's UTC activity day. */
    timelineDay: v.optional(v.string()),
    createdAtMs: v.number(),
    updatedAtMs: v.number(),
  })
    .index("by_updatedAtMs", ["updatedAtMs"])
    .index("by_timelineDay_updatedAtMs", ["timelineDay", "updatedAtMs"])
    .index("by_classification_timelineDay_updatedAtMs", [
      "classification",
      "timelineDay",
      "updatedAtMs",
    ])
    .index("by_eventKey_eventDate", ["eventKey", "eventDate"]),

  /** Immutable reporting runs. A dossier can have exactly one current revision. */
  videoIntelligenceAnalysisRevisions: defineTable({
    dossierId: v.id("videoIntelligenceDossiers"),
    contentJobId: v.optional(v.id("contentJobs")),
    analysisExecutionProfile: v.optional(videoIntelligenceExecutionProfile),
    revisionNumber: v.number(),
    lifecycle: v.union(v.literal("current"), v.literal("superseded")),
    sourceAuthorityKey: v.optional(v.string()),
    /** Server-validated outcome for this immutable revision's bounded comparison pass. */
    comparisonReceipt: v.optional(comparisonReceiptValidator),
    createdAtMs: v.number(),
    supersededAtMs: v.optional(v.number()),
  })
    .index("by_dossier_revisionNumber", ["dossierId", "revisionNumber"])
    .index("by_dossier_lifecycle", ["dossierId", "lifecycle"])
    .index("by_lifecycle_createdAtMs", ["lifecycle", "createdAtMs"]),

  videoIntelligenceTags: defineTable({
    canonicalName: v.string(),
    normalizedKey: v.string(),
    aliases: v.array(v.string()),
    provenance: v.array(tagProvenanceValidator),
    createdAtMs: v.number(),
    updatedAtMs: v.number(),
  }).index("by_normalizedKey", ["normalizedKey"]),

  videoIntelligenceContributions: defineTable({
    storyId: v.id("videoIntelligenceStories"),
    dossierId: v.id("videoIntelligenceDossiers"),
    revisionId: v.optional(v.id("videoIntelligenceAnalysisRevisions")),
    sourceAuthorityKey: v.optional(v.string()),
    frame: v.string(),
    summary: v.string(),
    claims: v.array(reportingClaimValidator),
    createdAtMs: v.number(),
    updatedAtMs: v.number(),
  })
    .index("by_storyId", ["storyId"])
    .index("by_dossierId", ["dossierId"])
    .index("by_revisionId", ["revisionId"]),

  /** Recurring coverage is month-bounded and intentionally separate from News. */
  videoIntelligenceTopics: defineTable({
    normalizedKey: v.string(),
    title: v.string(),
    month: v.string(),
    curatedWorldMarkdown: v.optional(v.string()),
    /** Materialized current-revision predicate for paged Topic reads. */
    visibleInTopics: v.optional(v.boolean()),
    createdAtMs: v.number(),
    updatedAtMs: v.number(),
  })
    .index("by_month_updatedAtMs", ["month", "updatedAtMs"])
    .index("by_month_normalizedKey", ["month", "normalizedKey"]),

  videoIntelligenceTopicCoverage: defineTable({
    topicId: v.id("videoIntelligenceTopics"),
    dossierId: v.id("videoIntelligenceDossiers"),
    revisionId: v.optional(v.id("videoIntelligenceAnalysisRevisions")),
    contributionId: v.optional(v.id("videoIntelligenceContributions")),
    sourceAuthorityKey: v.optional(v.string()),
    summary: v.string(),
    frame: v.string(),
    timelineDay: v.string(),
    createdAtMs: v.number(),
  })
    .index("by_topicId_createdAtMs", ["topicId", "createdAtMs"])
    .index("by_dossierId_createdAtMs", ["dossierId", "createdAtMs"])
    .index("by_revisionId", ["revisionId"]),

  /** Symmetric, agent-vetted comparisons backed by immutable current revisions. */
  videoIntelligenceComparisonEdges: defineTable({
    pairKey: v.string(),
    sourceAId: v.id("contentSources"),
    dossierAId: v.id("videoIntelligenceDossiers"),
    revisionAId: v.id("videoIntelligenceAnalysisRevisions"),
    sourceBId: v.id("contentSources"),
    dossierBId: v.id("videoIntelligenceDossiers"),
    revisionBId: v.id("videoIntelligenceAnalysisRevisions"),
    relationship: comparisonRelationshipValidator,
    rationale: v.string(),
    createdAtMs: v.number(),
    updatedAtMs: v.number(),
  })
    .index("by_pairKey", ["pairKey"])
    .index("by_dossierA_createdAtMs", ["dossierAId", "createdAtMs"])
    .index("by_dossierB_createdAtMs", ["dossierBId", "createdAtMs"])
    .index("by_revisionA", ["revisionAId"])
    .index("by_revisionB", ["revisionBId"]),
};
