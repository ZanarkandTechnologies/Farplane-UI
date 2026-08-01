/** Shared validators define the cloud write contract used by the extension bridge and projection query. */
import { v } from "convex/values";

export const sourceStatusValidator = v.union(
  v.literal("TRANSCRIPT_USED"),
  v.literal("SUMMARY_ONLY"),
  v.literal("TRANSCRIPT_UNAVAILABLE"),
);

export const claimStanceValidator = v.union(
  v.literal("supports"),
  v.literal("opposes"),
  v.literal("neutral"),
  v.literal("unclear"),
);

export const extractedEvidenceValidator = v.object({
  timestamp: v.union(v.string(), v.null()),
  excerpt: v.string(),
  schemaVersion: v.literal(2),
  extractorVersion: v.string(),
});

export const evidenceAnchorValidator = v.object({
  videoId: v.string(),
  sourceUrl: v.string(),
  sourceStatus: sourceStatusValidator,
  sourceKind: v.union(v.literal("transcript"), v.literal("page-owned")),
  timestamp: v.union(v.string(), v.null()),
  excerpt: v.string(),
  schemaVersion: v.literal(2),
  extractorVersion: v.string(),
});

export const extractedClaimValidator = v.object({
  statement: v.string(),
  stance: claimStanceValidator,
  evidence: extractedEvidenceValidator,
});

export const reportingClaimValidator = v.object({
  statement: v.string(),
  stance: claimStanceValidator,
  evidence: evidenceAnchorValidator,
});

export const extractedStoryValidator = v.object({
  title: v.string(),
  summary: v.string(),
  eventDate: v.union(v.string(), v.null()),
  entities: v.array(v.string()),
  tags: v.array(v.string()),
  frame: v.string(),
  claims: v.array(extractedClaimValidator),
});

export const projectRelevanceValidator = v.object({
  project: v.string(),
  reason: v.string(),
  confidence: v.number(),
});

export const clickbaitValidator = v.object({
  answer: v.string(),
  verdict: v.union(
    v.literal("DELIVERED"),
    v.literal("PARTIAL"),
    v.literal("BAIT"),
    v.literal("UNVERIFIABLE"),
  ),
  confidence: v.number(),
  evidence: v.array(v.string()),
});

export const keyPointValidator = v.object({
  finding: v.string(),
  detail: v.union(v.string(), v.null()),
  timestamp: v.union(v.string(), v.null()),
});

export const recommendationValidator = v.object({
  decision: v.union(v.literal("WATCH"), v.literal("READ"), v.literal("SKIP")),
  personalRelevance: v.union(v.number(), v.null()),
  contentQuality: v.number(),
  reasonCode: v.string(),
  rationale: v.string(),
  matchedProfile: v.array(v.string()),
});

export const videoAnalysisValidator = v.object({
  schemaVersion: v.literal(3),
  sourceStatus: sourceStatusValidator,
  sourceNote: v.string(),
  summary: v.string(),
  publisher: v.union(v.string(), v.null()),
  publishedAt: v.union(v.string(), v.null()),
  stories: v.array(extractedStoryValidator),
  projectRelevance: v.array(projectRelevanceValidator),
  clickbait: clickbaitValidator,
  keyPoints: v.array(keyPointValidator),
  recommendation: recommendationValidator,
});

export const tagProvenanceValidator = v.object({
  source: v.union(v.literal("analysis"), v.literal("migration")),
  dossierId: v.optional(v.id("videoIntelligenceDossiers")),
  firstSeenAtMs: v.number(),
});
