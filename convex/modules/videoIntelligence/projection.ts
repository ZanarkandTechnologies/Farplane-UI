/**
 * Cloud projection for AI Office. Video Intelligence starts from analyze jobs and
 * their content sources; Resource Bank is consulted only for the temporary legacy fallback.
 */
import { query } from "../../_generated/server";
import {
  type ContributionShape,
  extractYouTubeVideoId,
  rebuildStoryAggregate,
  rebuildStoryRelations,
  type StoryShape,
} from "./domain";

type ProjectionSource = {
  id: string;
  title: string;
  canonicalUrl: string;
  author?: string;
  projectId?: string;
  createdAtMs: number;
  updatedAtMs: number;
  job: {
    id: string;
    status: string;
    error?: string;
    externalTaskRef?: string;
    projectId?: string;
    progress?: {
      stage:
        | "queued"
        | "preparing"
        | "analyzing"
        | "persistence"
        | "complete"
        | "failed"
        | "needs_review";
      message: string;
      updatedAtMs: number;
    };
    createdAtMs: number;
    updatedAtMs: number;
  };
  legacy?: boolean;
  summary?: string;
};

export const getVideoIntelligenceProjection = query({
  args: {},
  handler: async (ctx) => {
    const [contentJobs, legacyJobs, structuredDossiers, storyRows, tagRows, contributionRows] =
      await Promise.all([
        ctx.db
          .query("contentJobs")
          .withIndex("by_kind_createdAtMs", (q) => q.eq("kind", "analyze_youtube"))
          .order("desc")
          .take(250),
        // Transitional only: old Vidgard jobs are identified by bridge provenance, never tags.
        ctx.db.query("resourceBankIngestionJobs").take(250),
        ctx.db
          .query("videoIntelligenceDossiers")
          .withIndex("by_updatedAtMs")
          .order("desc")
          .take(250),
        ctx.db
          .query("videoIntelligenceStories")
          .withIndex("by_updatedAtMs")
          .order("desc")
          .take(500),
        ctx.db.query("videoIntelligenceTags").take(500),
        ctx.db.query("videoIntelligenceContributions").take(1_500),
      ]);

    const genericSources = (
      await Promise.all(
        contentJobs.map(async (job): Promise<ProjectionSource | null> => {
          const source = await ctx.db.get(job.sourceId);
          if (!source) return null;
          const videoId = extractYouTubeVideoId(source.canonicalRef);
          if (!videoId) return null;
          return {
            id: String(source._id),
            title: source.title ?? videoId,
            canonicalUrl: source.canonicalRef,
            projectId: job.projectId,
            createdAtMs: source.createdAtMs,
            updatedAtMs: Math.max(source.updatedAtMs, job.updatedAtMs),
            job: {
              id: String(job._id),
              status: job.status,
              error: job.error,
              externalTaskRef: job.externalTaskRef,
              projectId: job.projectId,
              progress: job.progress,
              createdAtMs: job.createdAtMs,
              updatedAtMs: job.updatedAtMs,
            },
          };
        }),
      )
    ).filter((value): value is ProjectionSource => value !== null);

    const legacySources = (
      await Promise.all(
        legacyJobs
          .filter((job) => job.requestedBy === "farplane-youtube-shortcut" && !job.contentJobId)
          .map(async (job): Promise<ProjectionSource | null> => {
            const videoId = extractYouTubeVideoId(job.sourceRef);
            if (!videoId) return null;
            const asset = await ctx.db
              .query("resourceBankAssets")
              .withIndex("by_job", (q) => q.eq("ingestionJobId", job._id))
              .filter((q) => q.eq(q.field("assetRole"), "primary"))
              .first();
            if (!asset) return null;
            const analysis = await ctx.db
              .query("resourceBankAnalyses")
              .withIndex("by_asset", (q) => q.eq("assetId", asset._id))
              .order("desc")
              .first();
            return {
              id: String(asset._id),
              title: asset.title,
              canonicalUrl: asset.canonicalUrl ?? asset.sourceUrl ?? job.sourceRef,
              author: asset.author,
              projectId: asset.projectId ?? job.projectId,
              createdAtMs: asset.createdAtMs,
              updatedAtMs: Math.max(asset.updatedAtMs, job.updatedAtMs),
              job: {
                id: String(job._id),
                status: job.status,
                error: job.error,
                externalTaskRef: job.externalTaskRef,
                projectId: job.projectId,
                createdAtMs: job.createdAtMs,
                updatedAtMs: job.updatedAtMs,
              },
              legacy: true,
              summary: readableSummary(
                analysis?.analysisMarkdown ?? analysis?.embeddingText ?? asset.searchableText,
              ),
            };
          }),
      )
    ).filter((value): value is ProjectionSource => value !== null);

    const sourcesById = new Map<string, ProjectionSource>();
    for (const source of [...genericSources, ...legacySources]) {
      const existing = sourcesById.get(source.id);
      if (!existing || source.job.updatedAtMs > existing.job.updatedAtMs) {
        sourcesById.set(source.id, source);
      }
    }
    const sources = [...sourcesById.values()];
    const structuredByContentSource = new Map(
      structuredDossiers
        .filter((dossier) => dossier.contentSourceId)
        .map((dossier) => [String(dossier.contentSourceId), dossier]),
    );
    const structuredByLegacyAsset = new Map(
      structuredDossiers
        .filter((dossier) => dossier.resourceAssetId)
        .map((dossier) => [String(dossier.resourceAssetId), dossier]),
    );
    const activeDossierIds = new Set(structuredDossiers.map((dossier) => String(dossier._id)));
    const contributions: ContributionShape[] = contributionRows
      .filter((row) => activeDossierIds.has(String(row.dossierId)))
      .map((row) => ({
        id: String(row._id),
        storyId: String(row.storyId),
        dossierId: String(row.dossierId),
        frame: row.frame,
        summary: row.summary,
        claims: row.claims.map((claim, index) => ({ id: `${row._id}:claim:${index}`, ...claim })),
      }));
    const usedStoryIds = new Set(contributions.map((item) => item.storyId));
    const stories: StoryShape[] = storyRows
      .filter((row) => usedStoryIds.has(String(row._id)))
      .map((row) => ({
        id: String(row._id),
        title: row.title,
        summary: row.summary,
        eventDate: row.eventDate,
        entities: row.entities,
        tagIds: row.tagIds.map(String),
        createdAt: iso(row.createdAtMs),
        updatedAt: iso(row.updatedAtMs),
      }));
    const usedTagIds = new Set(stories.flatMap((story) => story.tagIds));
    const tags = tagRows
      .filter((row) => usedTagIds.has(String(row._id)))
      .map((row) => ({
        id: String(row._id),
        canonicalName: row.canonicalName,
        normalizedKey: row.normalizedKey,
        aliases: row.aliases,
        provenance: row.provenance.map((item) => ({
          source: item.source,
          dossierId: item.dossierId ? String(item.dossierId) : undefined,
          firstSeenAt: iso(item.firstSeenAtMs),
        })),
        createdAt: iso(row.createdAtMs),
        updatedAt: iso(row.updatedAtMs),
      }));
    const dossiers = sources.map((source) => {
      const videoId = extractYouTubeVideoId(source.canonicalUrl);
      if (!videoId) throw new Error("video_intelligence_youtube_id_missing");
      const structured = source.legacy
        ? structuredByLegacyAsset.get(source.id)
        : structuredByContentSource.get(source.id);
      if (!structured) return legacyDossier(source, videoId);
      const dossierId = String(structured._id);
      const storyIds = contributions
        .filter((item) => item.dossierId === dossierId)
        .map((item) => item.storyId);
      return {
        id: dossierId,
        videoId,
        canonicalUrl: source.canonicalUrl,
        title: source.title,
        publisher: structured.publisher ?? source.author ?? null,
        publishedAt: structured.publishedAt ?? null,
        summary: structured.summary,
        sourceStatus: structured.sourceStatus,
        sourceNote: structured.sourceNote,
        threadId: structured.threadId,
        storyIds: [...new Set(storyIds)],
        duplicateIngestCount: structured.duplicateIngestCount,
        relatedStoryIds: [
          ...new Set(
            contributions
              .filter((item) => item.dossierId !== dossierId && storyIds.includes(item.storyId))
              .map((item) => item.storyId),
          ),
        ],
        projectRelevance: structured.projectRelevance,
        clickbait: structured.clickbait,
        keyPoints: structured.keyPoints,
        recommendation: structured.recommendation,
        concepts: structured.concepts ?? [],
        legacy: false,
        createdAt: iso(structured.createdAtMs),
        updatedAt: iso(structured.updatedAtMs),
      };
    });
    const dossierBySourceId = new Map(sources.map((source, index) => [source.id, dossiers[index]]));
    const jobs = sources.flatMap((source) => {
      const dossier = dossierBySourceId.get(source.id);
      const videoId = extractYouTubeVideoId(source.canonicalUrl);
      if (!dossier || !videoId) return [];
      return [
        {
          id: source.job.id,
          sourceId: source.id,
          videoId,
          title: source.title,
          projectId: source.projectId ?? source.job.projectId,
          status: mapJobStatus(source.job.status),
          threadId: threadIdFromRef(source.job.externalTaskRef),
          dossierId: dossier.id,
          error: source.job.error,
          progress: source.job.progress
            ? {
                stage: source.job.progress.stage,
                message: source.job.progress.message,
                updatedAt: iso(source.job.progress.updatedAtMs),
              }
            : null,
          createdAt: iso(source.job.createdAtMs),
          updatedAt: iso(source.job.updatedAtMs),
        },
      ];
    });
    const updatedAtMs = Math.max(
      0,
      ...sources.map((source) => source.updatedAtMs),
      ...structuredDossiers.map((dossier) => dossier.updatedAtMs),
    );
    return {
      schemaVersion: 3 as const,
      revision: updatedAtMs,
      jobs,
      dossiers,
      stories,
      tags,
      relations: rebuildStoryRelations(stories, tags, iso(updatedAtMs || Date.now())),
      contributions,
      aggregates: stories.map((story) =>
        rebuildStoryAggregate(story.id, contributions, story.updatedAt),
      ),
      updatedAt: iso(updatedAtMs || Date.now()),
    };
  },
});

function legacyDossier(source: ProjectionSource, videoId: string) {
  return {
    id: source.id,
    videoId,
    canonicalUrl: source.canonicalUrl,
    title: source.title,
    publisher: source.author ?? null,
    publishedAt: null,
    summary: source.summary ?? "This video is retained for analysis.",
    sourceStatus: "RESOURCE_BANK" as const,
    sourceNote: "Legacy Vidgard record awaiting generic content-job migration.",
    threadId: "",
    storyIds: [],
    duplicateIngestCount: 1,
    relatedStoryIds: [],
    projectRelevance: source.projectId
      ? [
          {
            project: source.projectId,
            reason: "Linked by the original Vidgard analysis job.",
            confidence: 1,
          },
        ]
      : [],
    clickbait: null,
    keyPoints: [],
    recommendation: null,
    concepts: [],
    legacy: true,
    createdAt: iso(source.createdAtMs),
    updatedAt: iso(source.updatedAtMs),
  };
}

function readableSummary(value: string): string {
  return (
    value
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/[*_`>-]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 3_000) || "This video is retained for analysis."
  );
}
function mapJobStatus(status: string): "queued" | "running" | "succeeded" | "failed" {
  if (status === "queued") return "queued";
  if (status === "analyzing") return "running";
  if (status === "failed") return "failed";
  return "succeeded";
}
function threadIdFromRef(value?: string): string | undefined {
  const prefix = "codex-thread:";
  return value?.startsWith(prefix) ? value.slice(prefix.length) || undefined : undefined;
}
function iso(value: number): string {
  return new Date(value).toISOString();
}
