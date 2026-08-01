/** Video Intelligence tables extend Resource Bank videos with structured reporting relationships. */
import { defineTable } from "convex/server";
import { v } from "convex/values";
import {
  clickbaitValidator,
  keyPointValidator,
  projectRelevanceValidator,
  recommendationValidator,
  reportingClaimValidator,
  sourceStatusValidator,
  tagProvenanceValidator,
} from "./validators";

export const videoIntelligenceTables = {
  videoIntelligenceDossiers: defineTable({
    resourceAssetId: v.id("resourceBankAssets"),
    resourceJobId: v.id("resourceBankIngestionJobs"),
    videoId: v.string(),
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
    duplicateIngestCount: v.number(),
    createdAtMs: v.number(),
    updatedAtMs: v.number(),
  })
    .index("by_resourceAssetId", ["resourceAssetId"])
    .index("by_videoId", ["videoId"])
    .index("by_updatedAtMs", ["updatedAtMs"]),

  videoIntelligenceStories: defineTable({
    title: v.string(),
    summary: v.string(),
    eventDate: v.optional(v.string()),
    entities: v.array(v.string()),
    tagIds: v.array(v.id("videoIntelligenceTags")),
    status: v.literal("provisional"),
    createdAtMs: v.number(),
    updatedAtMs: v.number(),
  }).index("by_updatedAtMs", ["updatedAtMs"]),

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
    frame: v.string(),
    summary: v.string(),
    claims: v.array(reportingClaimValidator),
    createdAtMs: v.number(),
    updatedAtMs: v.number(),
  })
    .index("by_storyId", ["storyId"])
    .index("by_dossierId", ["dossierId"]),
};
