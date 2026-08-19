/** Browser-safe owner of the strict Video Intelligence analysis transport. */
import { z } from "zod";

export const ANALYSIS_SCHEMA_VERSION = 5 as const;

const httpsReferenceSchema = z
  .string()
  .min(8)
  .max(2000)
  .regex(/^https:\/\/[^\s]+$/, "Must be a direct HTTPS URL");

const evidenceSchema = z
  .object({
    timestamp: z.string().max(20).nullable(),
    excerpt: z.string().min(1).max(500),
    schemaVersion: z.literal(2),
    extractorVersion: z.string().min(1).max(120),
    reference: httpsReferenceSchema.nullable(),
  })
  .strict();

const newsCandidateSchema = z
  .object({
    title: z.string().min(1).max(300),
    summary: z.string().min(1).max(1500),
    eventDate: z.string().max(40).nullable(),
    entities: z.array(z.string().min(1).max(160)).max(12),
    tags: z.array(z.string().trim().min(1).max(80)).min(1).max(8),
    frame: z.string().min(1).max(1000),
    claims: z
      .array(
        z
          .object({
            statement: z.string().min(1).max(800),
            stance: z.enum(["supports", "opposes", "neutral", "unclear"]),
            evidence: evidenceSchema,
          })
          .strict(),
      )
      .max(8),
    eventKey: httpsReferenceSchema.nullable(),
    whyNow: z.string().min(1).max(500).nullable(),
    whyItMatters: z.string().min(1).max(800).nullable(),
  })
  .strict();

export const newsEnrichmentSchema = z
  .object({
    candidates: z.array(newsCandidateSchema).max(3),
  })
  .strict();

const relatedCoverageDecisionSchema = z
  .object({
    candidateSourceId: z.string().min(1).max(200),
    candidateRevisionId: z.string().min(1).max(200),
    relationship: z.enum(["same_development", "same_active_discussion"]),
    rationale: z.string().min(1).max(800),
  })
  .strict();

export const analysisSchema = z
  .object({
    schemaVersion: z.literal(ANALYSIS_SCHEMA_VERSION),
    sourceStatus: z.enum([
      "TRANSCRIPT_USED",
      "TRANSCRIPT_UNAVAILABLE",
      "SUMMARY_ONLY",
    ]),
    sourceNote: z.string().max(500),
    summary: z.string().min(1).max(3000),
    publisher: z.string().min(1).max(300).nullable(),
    publishedAt: z.string().max(40).nullable(),
    news: newsEnrichmentSchema.nullable(),
    concepts: z.array(z.string().trim().min(1).max(80)).max(12),
    relatedCoverage: z.array(relatedCoverageDecisionSchema).max(8),
    projectRelevance: z
      .array(
        z
          .object({
            project: z.string().min(1).max(200),
            reason: z.string().min(1).max(500),
            confidence: z.number().min(0).max(1),
          })
          .strict(),
      )
      .max(5),
    clickbait: z
      .object({
        answer: z.string().min(1).max(2000),
        verdict: z.enum(["DELIVERED", "PARTIAL", "BAIT", "UNVERIFIABLE"]),
        confidence: z.number().min(0).max(1),
        evidence: z.array(z.string().max(500)).max(3),
      })
      .strict(),
    keyPoints: z
      .array(
        z
          .object({
            finding: z.string().min(1).max(500),
            detail: z.string().max(1000).nullable(),
            timestamp: z.string().max(20).nullable(),
          })
          .strict(),
      )
      .max(7),
    recommendation: z
      .object({
        decision: z.enum(["WATCH", "READ", "SKIP"]),
        personalRelevance: z.number().min(0).max(1).nullable(),
        contentQuality: z.number().min(0).max(1),
        reasonCode: z.enum([
          "VISUALS_REQUIRED",
          "SUMMARY_SUFFICIENT",
          "LOW_SIGNAL",
          "ALREADY_KNOWN",
          "NOT_RELEVANT",
          "PROFILE_UNAVAILABLE",
        ]),
        rationale: z.string().min(1).max(1000),
        matchedProfile: z.array(z.string().max(300)).max(3),
      })
      .strict(),
  })
  .strict();

export type Analysis = z.infer<typeof analysisSchema>;

export function formatAnalysisIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 4)
    .map((issue) => `${issue.path.length ? issue.path.join(".") : "analysis"}: ${issue.message}`)
    .join("; ");
}

export function parseAnalysis(value: unknown): Analysis {
  const parsed = analysisSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  throw new Error(`Invalid analysis payload — ${formatAnalysisIssues(parsed.error)}`);
}
