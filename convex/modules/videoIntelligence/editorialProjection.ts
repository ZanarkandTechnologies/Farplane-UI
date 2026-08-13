/** Read-only, page-by-date projections for editorial News and month-bounded Topics. */
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import type { QueryCtx } from "../../_generated/server";
import { query } from "../../_generated/server";
import { isTimelineDay } from "../content/timeline";
import { hasOtherSourceCoverage } from "./editorial";

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
    return {
      id: String(story._id),
      title: story.title,
      summary: story.summary,
      eventDate: story.eventDate ?? null,
      eventKey: story.eventKey ?? null,
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

/**
 * Topics are infrastructure, not a library: expose them only when the open
 * dossier has current coverage from another dossier under the same lens.
 */
export const getDossierRelatedCoverage = query({
  args: { dossierId: v.id("videoIntelligenceDossiers") },
  handler: async (ctx, args) => {
    const coverageRows = await ctx.db
      .query("videoIntelligenceTopicCoverage")
      .withIndex("by_dossierId_createdAtMs", (q) => q.eq("dossierId", args.dossierId))
      .order("desc")
      .take(100);
    const topicIds = new Set<Id<"videoIntelligenceTopics">>();
    for (const row of coverageRows) {
      if (!row.revisionId) continue;
      const revision = await ctx.db.get(row.revisionId);
      if (revision?.lifecycle === "current") topicIds.add(row.topicId);
    }
    const topics = await Promise.all(
      [...topicIds].map(async (topicId) => {
        const topic = await ctx.db.get(topicId);
        return topic ? await toRelatedCoverageTopic(ctx, topic, args.dossierId) : null;
      }),
    );
    return topics
      .filter((topic): topic is NonNullable<typeof topic> => Boolean(topic))
      .sort(
        (left, right) =>
          right.coverageCount - left.coverageCount || left.title.localeCompare(right.title),
      );
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

async function toRelatedCoverageTopic(
  ctx: QueryCtx,
  topic: Doc<"videoIntelligenceTopics">,
  dossierId: Id<"videoIntelligenceDossiers">,
) {
  const coverage = await currentTopicCoverage(ctx, topic._id);
  const origin = await ctx.db.get(dossierId);
  if (!origin) return null;
  const originRevision = await ctx.db
    .query("videoIntelligenceAnalysisRevisions")
    .withIndex("by_dossier_lifecycle", (q) =>
      q.eq("dossierId", dossierId).eq("lifecycle", "current"),
    )
    .first();
  const coverageWithDossiers: Array<{
    item: Doc<"videoIntelligenceTopicCoverage">;
    dossier: Doc<"videoIntelligenceDossiers"> | null;
  }> = await Promise.all(
    coverage.map(async (item) => ({
      item,
      // item.dossierId is the table-specific source identity boundary.
      dossier: await ctx.db.get(item.dossierId as Id<"videoIntelligenceDossiers">),
    })),
  );
  const relatedCoverage = coverageWithDossiers.filter(
    ({ item, dossier }) =>
      dossier &&
      hasOtherSourceCoverage(
        {
          contentSourceId: origin.contentSourceId ? String(origin.contentSourceId) : null,
          sourceAuthorityKey: originRevision?.sourceAuthorityKey ?? null,
        },
        [
          {
            contentSourceId: dossier.contentSourceId ? String(dossier.contentSourceId) : null,
            sourceAuthorityKey: item.sourceAuthorityKey ?? null,
          },
        ],
      ),
  );
  if (!relatedCoverage.length) {
    return null;
  }
  const creators = new Set<string>();
  for (const { item, dossier } of relatedCoverage) {
    creators.add(dossier?.publisher ?? item.sourceAuthorityKey ?? String(item.dossierId));
  }
  return {
    id: String(topic._id),
    title: topic.title,
    month: topic.month,
    curatedWorldMarkdown: topic.curatedWorldMarkdown ?? null,
    coverageCount: relatedCoverage.length,
    creatorCount: creators.size,
    coverage: await Promise.all(relatedCoverage.map(({ item }) => toCoverageItem(ctx, item))),
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
