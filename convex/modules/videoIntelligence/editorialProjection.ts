/** Read-only, page-by-date projections for editorial News and month-bounded Topics. */
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import type { QueryCtx } from "../../_generated/server";
import { query } from "../../_generated/server";
import { isTimelineDay } from "../content/timeline";
import { publicationDay } from "./comparisonRules";
import { resolveNewsReferenceUrl } from "./editorial";

const direction = v.union(v.literal("latest"), v.literal("older"), v.literal("newer"));
const editorialStatus = v.union(v.literal("developing"), v.literal("aggregated"));
const month = /^\d{4}-\d{2}$/;

function isPublishedNews(story: Doc<"videoIntelligenceStories">): boolean {
  return (
    story.classification === "news" &&
    (story.editorialStatus === "developing" || story.editorialStatus === "aggregated")
  );
}

export const getNewsTimelineAnchor = query({
  args: { direction, day: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.direction !== "latest" && (!args.day || !isTimelineDay(args.day))) {
      throw new Error("news_timeline_anchor_day_invalid");
    }
    const story =
      args.direction === "latest"
        ? await ctx.db
            .query("videoIntelligenceStories")
            .withIndex("by_classification_timelineDay_updatedAtMs", (q) =>
              q.eq("classification", "news"),
            )
            .filter((q) => q.eq(q.field("visibleInNews"), true))
            .order("desc")
            .first()
        : args.direction === "older"
          ? await ctx.db
              .query("videoIntelligenceStories")
              .withIndex("by_classification_timelineDay_updatedAtMs", (q) =>
                q.eq("classification", "news").lt("timelineDay", args.day ?? ""),
              )
              .filter((q) => q.eq(q.field("visibleInNews"), true))
              .order("desc")
              .first()
          : await ctx.db
              .query("videoIntelligenceStories")
              .withIndex("by_classification_timelineDay_updatedAtMs", (q) =>
                q.eq("classification", "news").gt("timelineDay", args.day ?? ""),
              )
              .filter((q) => q.eq(q.field("visibleInNews"), true))
              .order("asc")
              .first();
    return story && isPublishedNews(story) ? (story.timelineDay ?? null) : null;
  },
});

export const getNewsForDay = query({
  args: {
    day: v.string(),
    paginationOpts: paginationOptsValidator,
    statuses: v.optional(v.array(editorialStatus)),
    projectId: v.optional(v.string()),
    source: v.optional(v.string()),
    topic: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!isTimelineDay(args.day)) throw new Error("news_timeline_day_invalid");
    const statuses = args.statuses?.length ? args.statuses : ["developing", "aggregated"];
    if (statuses.some((status) => status !== "developing" && status !== "aggregated")) {
      throw new Error("news_status_filter_invalid");
    }
    const result = await ctx.db
      .query("videoIntelligenceStories")
      .withIndex("by_classification_timelineDay_updatedAtMs", (q) =>
        q.eq("classification", "news").eq("timelineDay", args.day),
      )
      .filter((q) => q.eq(q.field("visibleInNews"), true))
      .order("desc")
      .paginate(args.paginationOpts);
    const page = await Promise.all(
      result.page
        .filter(
          (story) =>
            isPublishedNews(story) &&
            story.editorialStatus !== undefined &&
            statuses.includes(story.editorialStatus),
        )
        .map((story) => toNewsItem(ctx, story, args)),
    );
    return {
      ...result,
      page: page.filter((item): item is NonNullable<typeof item> => Boolean(item)),
    };
  },
});

export const getNewsDetail = query({
  args: { storyId: v.id("videoIntelligenceStories") },
  handler: async (ctx, args) => {
    const story = await ctx.db.get(args.storyId);
    if (!story || !isPublishedNews(story)) return null;
    const contributors = await currentContributors(ctx, story._id);
    if (contributors.length === 0) return null;
    const referenceUrl = resolveNewsReferenceUrl(
      story.eventKey,
      contributors.flatMap((contributor) => contributor.claims),
    );
    if (!referenceUrl) return null;
    return {
      id: String(story._id),
      title: story.title,
      summary: story.summary,
      eventDate: story.eventDate ?? null,
      eventKey: story.eventKey ?? null,
      referenceUrl,
      editorialStatus: story.editorialStatus ?? "developing",
      whyNow: story.whyNow ?? null,
      whyItMatters: story.whyItMatters ?? null,
      contributors,
    };
  },
});

export const getTopicMonthAnchor = query({
  args: { direction, month: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.direction !== "latest" && (!args.month || !month.test(args.month))) {
      throw new Error("topic_month_anchor_invalid");
    }
    const topic =
      args.direction === "latest"
        ? await ctx.db
            .query("videoIntelligenceTopics")
            .withIndex("by_month_updatedAtMs")
            .filter((q) => q.eq(q.field("visibleInTopics"), true))
            .order("desc")
            .first()
        : args.direction === "older"
          ? await ctx.db
              .query("videoIntelligenceTopics")
              .withIndex("by_month_updatedAtMs", (q) => q.lt("month", args.month ?? ""))
              .filter((q) => q.eq(q.field("visibleInTopics"), true))
              .order("desc")
              .first()
          : await ctx.db
              .query("videoIntelligenceTopics")
              .withIndex("by_month_updatedAtMs", (q) => q.gt("month", args.month ?? ""))
              .filter((q) => q.eq(q.field("visibleInTopics"), true))
              .order("asc")
              .first();
    return topic ? topic.month : null;
  },
});

export const getTopicsForMonth = query({
  args: { month: v.string(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    if (!month.test(args.month)) throw new Error("topic_month_invalid");
    const result = await ctx.db
      .query("videoIntelligenceTopics")
      .withIndex("by_month_updatedAtMs", (q) => q.eq("month", args.month))
      .filter((q) => q.eq(q.field("visibleInTopics"), true))
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      ...result,
      page: (await Promise.all(result.page.map((topic) => toTopicItem(ctx, topic)))).filter(
        (topic): topic is NonNullable<typeof topic> => Boolean(topic),
      ),
    };
  },
});

export const getTopicDetail = query({
  args: { topicId: v.id("videoIntelligenceTopics") },
  handler: async (ctx, args) => {
    const topic = await ctx.db.get(args.topicId);
    if (!topic) return null;
    const coverage = await currentTopicCoverage(ctx, topic._id);
    if (coverage.length === 0) return null;
    return {
      id: String(topic._id),
      title: topic.title,
      month: topic.month,
      curatedWorldMarkdown: topic.curatedWorldMarkdown ?? null,
      coverage: await Promise.all(coverage.map((item) => toCoverageItem(ctx, item))),
    };
  },
});

/** Related coverage reads only persisted, current-revision comparison edges. */
export const getDossierRelatedCoverage = query({
  args: { dossierId: v.id("videoIntelligenceDossiers") },
  handler: async (ctx, args) => {
    const [asSideA, asSideB] = await Promise.all([
      ctx.db
        .query("videoIntelligenceComparisonEdges")
        .withIndex("by_dossierA_createdAtMs", (q) => q.eq("dossierAId", args.dossierId))
        .order("desc")
        .take(100),
      ctx.db
        .query("videoIntelligenceComparisonEdges")
        .withIndex("by_dossierB_createdAtMs", (q) => q.eq("dossierBId", args.dossierId))
        .order("desc")
        .take(100),
    ]);
    const edges = [
      ...new Map([...asSideA, ...asSideB].map((edge) => [String(edge._id), edge])).values(),
    ];
    const related = await Promise.all(
      edges.map((edge) => toRelatedCoverageEdge(ctx, edge, args.dossierId)),
    );
    return related
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((left, right) => right.timelineDay.localeCompare(left.timelineDay));
  },
});

/** Curated links are authored references only; this mutation never writes World. */

async function toNewsItem(
  ctx: QueryCtx,
  story: Doc<"videoIntelligenceStories">,
  filter: { projectId?: string; source?: string; topic?: string },
) {
  const contributors = await currentContributors(ctx, story._id);
  if (contributors.length === 0) return null;
  const tags = await Promise.all(story.tagIds.map((tagId) => ctx.db.get(tagId)));
  const tagNames = tags.flatMap((tag) => (tag ? [tag.canonicalName] : []));
  const matchesTopic =
    !filter.topic || tagNames.some((tag) => tag.toLowerCase() === filter.topic?.toLowerCase());
  const sourceQuery = filter.source?.toLowerCase();
  const matchingContributors = contributors.filter((item) => {
    const sourceMatches =
      !sourceQuery ||
      [item.publisher, item.sourceTitle].some((value) =>
        value?.toLowerCase().includes(sourceQuery),
      );
    return sourceMatches && (!filter.projectId || item.projectId === filter.projectId);
  });
  if (!matchesTopic || ((filter.projectId || filter.source) && matchingContributors.length === 0))
    return null;
  const referenceUrl = resolveNewsReferenceUrl(
    story.eventKey,
    contributors.flatMap((contributor) => contributor.claims),
  );
  if (!referenceUrl) return null;
  const featuredContributor = matchingContributors[0];
  return {
    id: String(story._id),
    title: story.title,
    summary: story.summary,
    eventDate: story.eventDate ?? null,
    timelineDay: story.timelineDay ?? null,
    editorialStatus: story.editorialStatus ?? "developing",
    tags: tagNames,
    sourceCount: new Set(
      matchingContributors.map((item) => item.sourceAuthorityKey ?? item.dossierId),
    ).size,
    claimCount: matchingContributors.reduce((total, item) => total + item.claimCount, 0),
    whyItMatters: story.whyItMatters ?? null,
    referenceUrl,
    featuredSource: featuredContributor
      ? {
          title: featuredContributor.sourceTitle,
          publisher: featuredContributor.publisher,
          canonicalUrl: featuredContributor.canonicalUrl,
        }
      : null,
  };
}

async function toTopicItem(ctx: QueryCtx, topic: Doc<"videoIntelligenceTopics">) {
  const coverage = await currentTopicCoverage(ctx, topic._id);
  if (coverage.length === 0) return null;
  const creators = new Set<string>();
  for (const item of coverage) {
    const dossier = await ctx.db.get(item.dossierId as Id<"videoIntelligenceDossiers">);
    if (dossier?.publisher) creators.add(dossier.publisher);
    else creators.add(item.sourceAuthorityKey ?? String(item.dossierId));
  }
  return {
    id: String(topic._id),
    title: topic.title,
    month: topic.month,
    curatedWorldMarkdown: topic.curatedWorldMarkdown ?? null,
    coverageCount: coverage.length,
    creatorCount: creators.size,
  };
}

async function toRelatedCoverageEdge(
  ctx: QueryCtx,
  edge: Doc<"videoIntelligenceComparisonEdges">,
  dossierId: Id<"videoIntelligenceDossiers">,
) {
  const originIsA = edge.dossierAId === dossierId;
  if (!originIsA && edge.dossierBId !== dossierId) return null;
  const originRevisionId = originIsA ? edge.revisionAId : edge.revisionBId;
  const originSourceId = originIsA ? edge.sourceAId : edge.sourceBId;
  const relatedRevisionId = originIsA ? edge.revisionBId : edge.revisionAId;
  const relatedDossierId = originIsA ? edge.dossierBId : edge.dossierAId;
  const relatedSourceId = originIsA ? edge.sourceBId : edge.sourceAId;
  const [originRevision, originDossier, relatedRevision, relatedDossier, relatedSource] =
    await Promise.all([
      ctx.db.get(originRevisionId),
      ctx.db.get(dossierId),
      ctx.db.get(relatedRevisionId),
      ctx.db.get(relatedDossierId),
      ctx.db.get(relatedSourceId),
    ]);
  if (
    originRevision?.lifecycle !== "current" ||
    originRevision.dossierId !== dossierId ||
    originDossier?.contentSourceId !== originSourceId ||
    relatedRevision?.lifecycle !== "current" ||
    relatedRevision.dossierId !== relatedDossierId ||
    !relatedDossier ||
    relatedDossier.contentSourceId !== relatedSourceId ||
    !relatedSource
  ) {
    return null;
  }
  return {
    id: String(edge._id),
    dossierId: String(relatedDossier._id),
    sourceId: String(relatedSource._id),
    title: relatedSource.title ?? relatedDossier.videoId,
    publisher: relatedDossier.publisher ?? null,
    canonicalUrl: relatedSource.canonicalRef,
    summary: relatedDossier.summary,
    relationship: edge.relationship,
    rationale: edge.rationale,
    timelineDay:
      publicationDay(relatedDossier.publishedAt) ??
      relatedDossier.timelineDay ??
      new Date(relatedDossier.updatedAtMs).toISOString().slice(0, 10),
  };
}

async function currentContributors(ctx: QueryCtx, storyId: Id<"videoIntelligenceStories">) {
  const contributions = await ctx.db
    .query("videoIntelligenceContributions")
    .withIndex("by_storyId", (q) => q.eq("storyId", storyId))
    .collect();
  const current = [];
  for (const contribution of contributions) {
    if (!contribution.revisionId) continue;
    const revision = await ctx.db.get(contribution.revisionId);
    if (revision?.lifecycle !== "current") continue;
    const dossier = await ctx.db.get(contribution.dossierId);
    if (!dossier) continue;
    const source = dossier.contentSourceId ? await ctx.db.get(dossier.contentSourceId) : null;
    const job = dossier.contentJobId ? await ctx.db.get(dossier.contentJobId) : null;
    current.push({
      id: String(contribution._id),
      dossierId: String(dossier._id),
      sourceAuthorityKey: contribution.sourceAuthorityKey ?? revision.sourceAuthorityKey ?? null,
      sourceTitle: source?.title ?? dossier.videoId,
      publisher: dossier.publisher ?? null,
      projectId: job?.projectId ?? null,
      frame: contribution.frame,
      summary: contribution.summary,
      claimCount: contribution.claims.length,
      claims: contribution.claims,
      canonicalUrl: source?.canonicalRef ?? `https://www.youtube.com/watch?v=${dossier.videoId}`,
    });
  }
  return current;
}

async function currentTopicCoverage(ctx: QueryCtx, topicId: Id<"videoIntelligenceTopics">) {
  const rows = await ctx.db
    .query("videoIntelligenceTopicCoverage")
    .withIndex("by_topicId_createdAtMs", (q) => q.eq("topicId", topicId))
    .order("desc")
    .collect();
  const current = [];
  for (const row of rows) {
    if (!row.revisionId) continue;
    const revision = await ctx.db.get(row.revisionId);
    if (revision?.lifecycle === "current") current.push(row);
  }
  return current;
}

async function toCoverageItem(ctx: QueryCtx, item: Doc<"videoIntelligenceTopicCoverage">) {
  const dossier = await ctx.db.get(item.dossierId);
  const source = dossier?.contentSourceId ? await ctx.db.get(dossier.contentSourceId) : null;
  return {
    id: String(item._id),
    dossierId: String(item.dossierId),
    title: source?.title ?? dossier?.videoId ?? "Retained source",
    publisher: dossier?.publisher ?? null,
    canonicalUrl:
      source?.canonicalRef ??
      (dossier ? `https://www.youtube.com/watch?v=${dossier.videoId}` : null),
    summary: item.summary,
    frame: item.frame,
    timelineDay: item.timelineDay,
  };
}
