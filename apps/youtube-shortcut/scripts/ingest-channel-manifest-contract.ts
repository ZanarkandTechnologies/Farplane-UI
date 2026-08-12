import { z } from "zod";

export const manifestSchema = z.object({
  schemaVersion: z.literal(1),
  channelUrl: z.string().url(),
  requestedYear: z.literal(2026),
  generatedAt: z.string().min(1),
  videos: z
    .array(
      z.object({
        videoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
        publishedAt: z.string().regex(/^2026-\d{2}-\d{2}$/),
        title: z.string().trim().min(1).max(300),
      }),
    )
    .min(1),
  boundary: z.object({
    videoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
    publishedAt: z.string().regex(/^2025-/),
    title: z.string().min(1),
  }),
});

export const reportRecordSchema = z.object({
  videoId: z.string(),
  title: z.string(),
  attempts: z.number().int().nonnegative(),
  status: z.enum(["succeeded", "skipped", "failed", "blocked"]),
  classification: z.enum([
    "none",
    "source_unavailable",
    "auth",
    "timeout",
    "transport",
    "validation",
    "canonical",
    "unknown",
  ]),
  projectId: z.string().optional(),
  jobId: z.string().optional(),
  sourceId: z.string().optional(),
  threadId: z.string().optional(),
  error: z.string().optional(),
  updatedAt: z.string(),
});

export const reportSchema = z.object({
  schemaVersion: z.literal(1),
  manifestPath: z.string(),
  channelUrl: z.string().url(),
  requestedYear: z.literal(2026),
  projectId: z.string().min(1),
  endpoint: z.string().url(),
  startedAt: z.string(),
  updatedAt: z.string(),
  videos: z.array(reportRecordSchema),
  summary: z.object({
    total: z.number().int().nonnegative(),
    succeeded: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    blocked: z.number().int().nonnegative(),
    unresolved: z.number().int().nonnegative(),
  }),
});

export type ChannelManifest = z.infer<typeof manifestSchema>;
export type ManifestRecord = z.infer<typeof reportRecordSchema>;
export type ManifestIngestReport = z.infer<typeof reportSchema>;

export type ManifestRunnerOptions = {
  manifestPath?: string;
  reportPath?: string;
  endpoint?: string;
  projectId?: string;
  maxSources?: number;
  concurrency?: number;
};
