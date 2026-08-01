/**
 * Video Intelligence cloud writes. The YouTube loopback bridge calls these mutations;
 * Resource Bank remains the source owner while this module adds reporting structure.
 */
import { type Infer, v } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { mutation } from "../../_generated/server";
import {
  analysisMarkdown,
  findYouTubeAssetByVideoId,
  matchStory,
  normalizeTagKey,
  youtubeUrlVariants,
} from "./domain";
import {
  extractedStoryValidator,
  videoAnalysisValidator,
} from "./validators";

type ExtractedStory = Infer<typeof extractedStoryValidator>;

const queueResultValidator = v.object({
  jobId: v.id("resourceBankIngestionJobs"),
  assetId: v.id("resourceBankAssets"),
  videoId: v.string(),
  title: v.string(),
  createdAtMs: v.number(),
  updatedAtMs: v.number(),
});

export const queueVideo = mutation({
  args: { videoId: v.string(), title: v.string() },
  returns: queueResultValidator,
  handler: async (ctx, args) => {
    const canonicalUrl = canonicalVideoUrl(args.videoId);
    const title = clean(args.title, 300) || args.videoId;
    const now = Date.now();
    const existingAsset =
      (await ctx.db
        .query("resourceBankAssets")
        .withIndex("by_canonicalUrl", (q) => q.eq("canonicalUrl", canonicalUrl))
        .first()) ??
      (await firstAssetBySourceUrl(ctx, args.videoId)) ??
      findYouTubeAssetByVideoId(
        await ctx.db
          .query("resourceBankAssets")
          .withIndex("by_assetKind_assetRole_createdAtMs", (q) =>
            q.eq("assetKind", "video").eq("assetRole", "primary"),
          )
          .collect(),
        args.videoId,
      );
    if (existingAsset) {
      const job = await ctx.db.get(existingAsset.ingestionJobId);
      if (!job) throw new Error("video_intelligence_resource_job_missing");
      await ctx.db.patch(job._id, {
        status: "analyzing",
        error: undefined,
        updatedAtMs: now,
      });
      await ctx.db.patch(existingAsset._id, { title, updatedAtMs: now });
      return {
        jobId: job._id,
        assetId: existingAsset._id,
        videoId: args.videoId,
        title,
        createdAtMs: job.createdAtMs,
        updatedAtMs: now,
      };
    }
    const jobId = await ctx.db.insert("resourceBankIngestionJobs", {
      sourceKind: "video",
      sourceRef: canonicalUrl,
      originalInstruction: "Analyze this YouTube video for reporting claims and stories.",
      requestedFocus: "Video Intelligence",
      tags: ["youtube", "video-intelligence"],
      requestedBy: "farplane-youtube-shortcut",
      status: "analyzing",
      sourcePrivacy: "public",
      createdAtMs: now,
      updatedAtMs: now,
    });
    const assetId = await ctx.db.insert("resourceBankAssets", {
      ingestionJobId: jobId,
      assetRole: "primary",
      assetKind: "video",
      title,
      sourceUrl: canonicalUrl,
      canonicalUrl,
      platform: "YouTube",
      attributionStatus: "unknown",
      outputTypes: [],
      audiences: [],
      ageRanges: [],
      industries: [],
      customerRoles: [],
      tags: ["youtube", "video-intelligence"],
      searchableText: `${title}\n${canonicalUrl}\nyoutube\nvideo-intelligence`,
      retentionNote: "Canonical public URL and cloud analysis retained; raw video is not stored.",
      createdAtMs: now,
      updatedAtMs: now,
    });
    return { jobId, assetId, videoId: args.videoId, title, createdAtMs: now, updatedAtMs: now };
  },
});

export const attachThread = mutation({
  args: {
    jobId: v.id("resourceBankIngestionJobs"),
    threadId: v.string(),
  },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      externalTaskRef: `codex-thread:${clean(args.threadId, 180)}`,
      updatedAtMs: Date.now(),
    });
    return { ok: true };
  },
});

export const failVideo = mutation({
  args: {
    jobId: v.id("resourceBankIngestionJobs"),
    error: v.string(),
    threadId: v.optional(v.string()),
  },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      status: "failed",
      error: clean(args.error, 2_000),
      externalTaskRef: args.threadId
        ? `codex-thread:${clean(args.threadId, 180)}`
        : undefined,
      updatedAtMs: Date.now(),
    });
    return { ok: true };
  },
});

export const completeVideo = mutation({
  args: {
    jobId: v.id("resourceBankIngestionJobs"),
    assetId: v.id("resourceBankAssets"),
    videoId: v.string(),
    threadId: v.string(),
    analysis: videoAnalysisValidator,
  },
  returns: v.object({ dossierId: v.id("videoIntelligenceDossiers") }),
  handler: async (ctx, args) => {
    const [job, asset] = await Promise.all([ctx.db.get(args.jobId), ctx.db.get(args.assetId)]);
    if (!job || !asset || asset.ingestionJobId !== args.jobId) {
      throw new Error("video_intelligence_resource_binding_invalid");
    }
    const now = Date.now();
    await retainResourceAnalysis(ctx, args.jobId, args.assetId, args.analysis, now);
    const existingDossier = await ctx.db
      .query("videoIntelligenceDossiers")
      .withIndex("by_resourceAssetId", (q) => q.eq("resourceAssetId", args.assetId))
      .first();
    const dossierFields = {
      resourceAssetId: args.assetId,
      resourceJobId: args.jobId,
      videoId: args.videoId,
      threadId: clean(args.threadId, 200),
      publisher: nullableText(args.analysis.publisher, 300),
      publishedAt: nullableText(args.analysis.publishedAt, 40),
      summary: clean(args.analysis.summary, 3_000),
      sourceStatus: args.analysis.sourceStatus,
      sourceNote: clean(args.analysis.sourceNote, 500),
      projectRelevance: args.analysis.projectRelevance,
      clickbait: args.analysis.clickbait,
      keyPoints: args.analysis.keyPoints,
      recommendation: args.analysis.recommendation,
      duplicateIngestCount: (existingDossier?.duplicateIngestCount ?? 0) + 1,
      createdAtMs: existingDossier?.createdAtMs ?? now,
      updatedAtMs: now,
    };
    const dossierId = existingDossier
      ? (await ctx.db.patch(existingDossier._id, dossierFields), existingDossier._id)
      : await ctx.db.insert("videoIntelligenceDossiers", dossierFields);

    const previousContributions = await ctx.db
      .query("videoIntelligenceContributions")
      .withIndex("by_dossierId", (q) => q.eq("dossierId", dossierId))
      .collect();
    const previousStoryIds = previousContributions.map((item) => item.storyId);
    for (const contribution of previousContributions) await ctx.db.delete(contribution._id);

    const storyRows = await ctx.db.query("videoIntelligenceStories").take(500);
    const storyShapes = storyRows.map(toStoryShape);
    for (const extractedStory of args.analysis.stories) {
      const tagIds = await resolveTags(ctx, extractedStory.tags, dossierId, now);
      const matched = matchStory(extractedStory, storyShapes);
      let storyId: Id<"videoIntelligenceStories">;
      if (matched) {
        storyId = matched.rawId;
        const entities = [...new Set([...matched.entities, ...extractedStory.entities])];
        const mergedTagIds = [
          ...new Set([...matched.tagIds, ...tagIds.map(String)]),
        ] as Id<"videoIntelligenceTags">[];
        await ctx.db.patch(storyId, { entities, tagIds: mergedTagIds, updatedAtMs: now });
        matched.entities = entities;
        matched.tagIds = mergedTagIds.map(String);
        matched.updatedAt = new Date(now).toISOString();
      } else {
        storyId = await ctx.db.insert("videoIntelligenceStories", {
          title: clean(extractedStory.title, 300),
          summary: clean(extractedStory.summary, 1_500),
          eventDate: nullableText(extractedStory.eventDate, 40),
          entities: extractedStory.entities.map((item) => clean(item, 160)).filter(Boolean),
          tagIds,
          status: "provisional",
          createdAtMs: now,
          updatedAtMs: now,
        });
        storyShapes.push({
          id: String(storyId),
          rawId: storyId,
          title: extractedStory.title,
          summary: extractedStory.summary,
          eventDate: extractedStory.eventDate ?? undefined,
          entities: extractedStory.entities,
          tagIds: tagIds.map(String),
          createdAt: new Date(now).toISOString(),
          updatedAt: new Date(now).toISOString(),
        });
      }
      await ctx.db.insert("videoIntelligenceContributions", {
        storyId,
        dossierId,
        frame: clean(extractedStory.frame, 1_000),
        summary: clean(extractedStory.summary, 1_500),
        claims: extractedStory.claims.map((claim) => ({
          statement: clean(claim.statement, 800),
          stance: claim.stance,
          evidence: {
            videoId: args.videoId,
            sourceUrl: canonicalVideoUrl(args.videoId),
            sourceStatus: args.analysis.sourceStatus,
            sourceKind:
              args.analysis.sourceStatus === "TRANSCRIPT_USED" ? "transcript" : "page-owned",
            timestamp: claim.evidence.timestamp,
            excerpt: clean(claim.evidence.excerpt, 500),
            schemaVersion: 2,
            extractorVersion: clean(claim.evidence.extractorVersion, 120),
          },
        })),
        createdAtMs: now,
        updatedAtMs: now,
      });
    }

    for (const storyId of new Set(previousStoryIds)) {
      const remaining = await ctx.db
        .query("videoIntelligenceContributions")
        .withIndex("by_storyId", (q) => q.eq("storyId", storyId))
        .first();
      if (!remaining) await ctx.db.delete(storyId);
    }
    await ctx.db.patch(args.jobId, {
      status: "ready",
      error: undefined,
      externalTaskRef: `codex-thread:${clean(args.threadId, 180)}`,
      completedAtMs: now,
      updatedAtMs: now,
    });
    return { dossierId };
  },
});

async function resolveTags(
  ctx: MutationCtx,
  names: string[],
  dossierId: Id<"videoIntelligenceDossiers">,
  now: number,
): Promise<Id<"videoIntelligenceTags">[]> {
  const ids: Id<"videoIntelligenceTags">[] = [];
  for (const rawName of names) {
    const canonicalName = clean(rawName, 80);
    const normalizedKey = normalizeTagKey(canonicalName);
    if (!normalizedKey) continue;
    const existing = await ctx.db
      .query("videoIntelligenceTags")
      .withIndex("by_normalizedKey", (q) => q.eq("normalizedKey", normalizedKey))
      .first();
    if (existing) {
      const aliases =
        existing.canonicalName !== canonicalName && !existing.aliases.includes(canonicalName)
          ? [...existing.aliases, canonicalName]
          : existing.aliases;
      const provenance = existing.provenance.some((item) => item.dossierId === dossierId)
        ? existing.provenance
        : [...existing.provenance, { source: "analysis" as const, dossierId, firstSeenAtMs: now }];
      await ctx.db.patch(existing._id, { aliases, provenance, updatedAtMs: now });
      ids.push(existing._id);
    } else {
      ids.push(
        await ctx.db.insert("videoIntelligenceTags", {
          canonicalName,
          normalizedKey,
          aliases: [],
          provenance: [{ source: "analysis", dossierId, firstSeenAtMs: now }],
          createdAtMs: now,
          updatedAtMs: now,
        }),
      );
    }
  }
  return [...new Set(ids)];
}

async function retainResourceAnalysis(
  ctx: MutationCtx,
  jobId: Id<"resourceBankIngestionJobs">,
  assetId: Id<"resourceBankAssets">,
  analysis: Infer<typeof videoAnalysisValidator>,
  now: number,
): Promise<void> {
  const markdown = analysisMarkdown(analysis);
  const existing = await ctx.db
    .query("resourceBankAnalyses")
    .withIndex("by_asset", (q) => q.eq("assetId", assetId))
    .take(20);
  if (existing.some((item) => item.analysisMarkdown === markdown)) return;
  const tags = [...new Set(analysis.stories.flatMap((story) => story.tags.map(normalizeTagKey)))];
  await ctx.db.insert("resourceBankAnalyses", {
    ingestionJobId: jobId,
    assetId,
    sourceSkill: "summarize",
    analysisMarkdown: markdown,
    confidence: analysis.sourceStatus === "TRANSCRIPT_USED" ? "high" : "medium",
    embeddingTarget: "analysis_search",
    embeddingText: `${analysis.summary}\n${analysis.stories.map((story) => story.summary).join("\n")}`,
    tags,
    createdAtMs: now,
  });
}

function toStoryShape(row: {
  _id: Id<"videoIntelligenceStories">;
  title: string;
  summary: string;
  eventDate?: string;
  entities: string[];
  tagIds: Id<"videoIntelligenceTags">[];
  createdAtMs: number;
  updatedAtMs: number;
}) {
  return {
    id: String(row._id),
    rawId: row._id,
    title: row.title,
    summary: row.summary,
    eventDate: row.eventDate,
    entities: row.entities,
    tagIds: row.tagIds.map(String),
    createdAt: new Date(row.createdAtMs).toISOString(),
    updatedAt: new Date(row.updatedAtMs).toISOString(),
  };
}

function canonicalVideoUrl(videoId: string): string {
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) throw new Error("video_id_invalid");
  return `https://www.youtube.com/watch?v=${videoId}`;
}

async function firstAssetBySourceUrl(ctx: MutationCtx, videoId: string) {
  for (const sourceUrl of youtubeUrlVariants(videoId)) {
    const asset = await ctx.db
      .query("resourceBankAssets")
      .withIndex("by_sourceUrl", (q) => q.eq("sourceUrl", sourceUrl))
      .first();
    if (asset) return asset;
  }
  return null;
}

function nullableText(value: string | null, max: number): string | undefined {
  return value === null ? undefined : clean(value, max) || undefined;
}

function clean(value: string, max: number): string {
  return value.trim().replace(/\s+/g, " ").slice(0, max);
}
