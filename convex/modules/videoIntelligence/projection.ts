/**
 * Cloud projection for AI Office. It merges existing Resource Bank YouTube assets
 * with structured Video Intelligence records so historical ingestions appear immediately.
 */
import { query } from "../../_generated/server";
import {
  extractYouTubeVideoId,
  filterYouTubeAssets,
  rebuildStoryAggregate,
  rebuildStoryRelations,
  type ContributionShape,
  type StoryShape,
} from "./domain";

export const getVideoIntelligenceProjection = query({
  args: {},
  handler: async (ctx) => {
    const videoAssets = filterYouTubeAssets(
      await ctx.db
        .query("resourceBankAssets")
        .withIndex("by_assetKind_assetRole_createdAtMs", (q) =>
          q.eq("assetKind", "video").eq("assetRole", "primary"),
        )
        .order("desc")
        .collect(),
    );
    const [structuredDossiers, storyRows, tagRows, contributionRows] = await Promise.all([
      ctx.db.query("videoIntelligenceDossiers").withIndex("by_updatedAtMs").order("desc").take(250),
      ctx.db.query("videoIntelligenceStories").withIndex("by_updatedAtMs").order("desc").take(500),
      ctx.db.query("videoIntelligenceTags").take(500),
      ctx.db.query("videoIntelligenceContributions").take(1_500),
    ]);
    const structuredByAsset = new Map(
      structuredDossiers.map((dossier) => [String(dossier.resourceAssetId), dossier]),
    );
    const jobAndAnalysis = await Promise.all(
      videoAssets.map(async (asset) => ({
        asset,
        job: await ctx.db.get(asset.ingestionJobId),
        analyses: await ctx.db
          .query("resourceBankAnalyses")
          .withIndex("by_asset", (q) => q.eq("assetId", asset._id))
          .order("desc")
          .take(10),
      })),
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
        claims: row.claims.map((claim, index) => ({
          id: `${row._id}:claim:${index}`,
          ...claim,
        })),
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
    const dossiers = jobAndAnalysis.map(({ asset, analyses }) => {
      const videoId = extractYouTubeVideoId(asset.canonicalUrl ?? asset.sourceUrl);
      if (!videoId) throw new Error("video_intelligence_youtube_id_missing");
      const structured = structuredByAsset.get(String(asset._id));
      if (!structured) return legacyDossier(asset, analyses[0], videoId);
      const dossierId = String(structured._id);
      const storyIds = contributions
        .filter((item) => item.dossierId === dossierId)
        .map((item) => item.storyId);
      const relatedStoryIds = [...new Set(
        contributions
          .filter(
            (item) =>
              item.dossierId !== dossierId && storyIds.includes(item.storyId),
          )
          .map((item) => item.storyId),
      )];
      return {
        id: dossierId,
        videoId,
        canonicalUrl: asset.canonicalUrl ?? asset.sourceUrl ?? youtubeUrl(videoId),
        title: asset.title,
        publisher: structured.publisher ?? asset.author ?? null,
        publishedAt: structured.publishedAt ?? null,
        summary: structured.summary,
        sourceStatus: structured.sourceStatus,
        sourceNote: structured.sourceNote,
        threadId: structured.threadId,
        storyIds: [...new Set(storyIds)],
        duplicateIngestCount: structured.duplicateIngestCount,
        relatedStoryIds,
        projectRelevance: structured.projectRelevance,
        clickbait: structured.clickbait,
        keyPoints: structured.keyPoints,
        recommendation: structured.recommendation,
        legacy: false,
        createdAt: iso(structured.createdAtMs),
        updatedAt: iso(structured.updatedAtMs),
      };
    });
    const dossierByAssetId = new Map(
      jobAndAnalysis.map(({ asset }, index) => [String(asset._id), dossiers[index]]),
    );
    const jobs = jobAndAnalysis.flatMap(({ asset, job }) => {
      const dossier = dossierByAssetId.get(String(asset._id));
      const videoId = extractYouTubeVideoId(asset.canonicalUrl ?? asset.sourceUrl);
      if (!job || !dossier || !videoId) return [];
      return [{
        id: String(job._id),
        videoId,
        title: asset.title,
        status: mapJobStatus(job.status),
        threadId: threadIdFromRef(job.externalTaskRef),
        dossierId: dossier.id,
        error: job.error,
        createdAt: iso(job.createdAtMs),
        updatedAt: iso(job.updatedAtMs),
      }];
    });
    const updatedAtMs = Math.max(
      0,
      ...videoAssets.map((asset) => asset.updatedAtMs),
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

type AssetRow = {
  _id: string;
  title: string;
  author?: string;
  canonicalUrl?: string;
  sourceUrl?: string;
  searchableText: string;
  projectId?: string;
  createdAtMs: number;
  updatedAtMs: number;
};

type AnalysisRow = { analysisMarkdown?: string; embeddingText?: string; transcriptText?: string };

function legacyDossier(asset: AssetRow, analysis: AnalysisRow | undefined, videoId: string) {
  const summary = readableSummary(
    analysis?.analysisMarkdown ?? analysis?.embeddingText ?? asset.searchableText,
  );
  return {
    id: String(asset._id),
    videoId,
    canonicalUrl: asset.canonicalUrl ?? asset.sourceUrl ?? youtubeUrl(videoId),
    title: asset.title,
    publisher: asset.author ?? null,
    publishedAt: null,
    summary,
    sourceStatus: "RESOURCE_BANK" as const,
    sourceNote:
      "Imported from the existing Convex Resource Bank. Story claims will be added when this source is re-analyzed for Video Intelligence.",
    threadId: "",
    storyIds: [],
    duplicateIngestCount: 1,
    relatedStoryIds: [],
    projectRelevance: asset.projectId
      ? [{ project: asset.projectId, reason: "Linked by the original Resource Bank ingestion.", confidence: 1 }]
      : [],
    clickbait: null,
    keyPoints: [],
    recommendation: null,
    legacy: true,
    createdAt: iso(asset.createdAtMs),
    updatedAt: iso(asset.updatedAtMs),
  };
}

function readableSummary(value: string): string {
  const plain = value
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_`>-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return plain.slice(0, 3_000) || "This video is retained in the Convex Resource Bank.";
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

function youtubeUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

function iso(value: number): string {
  return new Date(value).toISOString();
}
