/**
 * Paginated read model for the Content Intelligence workspace.
 * Hydration is deliberately bounded to the returned source page.
 */
import { paginationOptsValidator } from "convex/server";
import type { Doc } from "../../_generated/dataModel";
import type { QueryCtx } from "../../_generated/server";
import { query } from "../../_generated/server";
import { resolveContentSummary } from "./intelligenceProjectionModel";

export const getContentIntelligenceProjection = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const sourcePage = await ctx.db
      .query("contentSources")
      .withIndex("by_updatedAtMs")
      .order("desc")
      .paginate(args.paginationOpts);
    const page = await Promise.all(
      sourcePage.page.map((source) => hydrateContentSource(ctx, source)),
    );
    return { ...sourcePage, page };
  },
});

export async function hydrateContentSource(ctx: QueryCtx, source: Doc<"contentSources">) {
  const [jobs, discoveries, dossier] = await Promise.all([
    ctx.db
      .query("contentJobs")
      .withIndex("by_source", (q) => q.eq("sourceId", source._id))
      .take(16),
    ctx.db
      .query("contentDiscoveries")
      .withIndex("by_source_observedDate", (q) => q.eq("contentSourceId", source._id))
      .order("desc")
      .take(6),
    ctx.db
      .query("videoIntelligenceDossiers")
      .withIndex("by_contentSourceId", (q) => q.eq("contentSourceId", source._id))
      .first(),
  ]);
  const orderedJobs = [...jobs].sort((left, right) => right.updatedAtMs - left.updatedAtMs);
  const latestSaveJob = orderedJobs.find((job) => job.kind === "save_reference");
  const asset = latestSaveJob
    ? await ctx.db
        .query("resourceBankAssets")
        .withIndex("by_contentJobId", (q) => q.eq("contentJobId", latestSaveJob._id))
        .first()
    : null;
  const analyses = asset
    ? await ctx.db
        .query("resourceBankAnalyses")
        .withIndex("by_asset", (q) => q.eq("assetId", asset._id))
        .take(6)
    : [];
  const latestAnalysis = [...analyses].sort(
    (left, right) => right.createdAtMs - left.createdAtMs,
  )[0];
  const latestDiscovery = discoveries[0];
  const projectIds = [
    ...new Set(
      [
        ...orderedJobs.map((job) => job.projectId),
        ...discoveries.map((item) => item.contentProjectId),
      ].filter((value): value is string => Boolean(value)),
    ),
  ];
  const summary = resolveContentSummary({
    dossierSummary: dossier?.summary,
    resourceBankAnalysis: latestAnalysis?.analysisMarkdown,
    feedScoutSummary: latestDiscovery?.summary,
  });
  return {
    id: String(source._id),
    sourceKind: source.sourceKind,
    sourceRef: source.sourceRef,
    canonicalRef: source.canonicalRef,
    title: source.title ?? source.canonicalRef,
    platform: source.platform,
    createdAt: new Date(source.createdAtMs).toISOString(),
    updatedAt: new Date(source.updatedAtMs).toISOString(),
    lastObservedAt: latestDiscovery?.observedDate ?? new Date(source.updatedAtMs).toISOString(),
    latestDiscovery: latestDiscovery
      ? {
          origin: latestDiscovery.origin,
          observedDate: latestDiscovery.observedDate,
          entityGroupId: latestDiscovery.entityGroupId,
          feedSourceId: latestDiscovery.feedSourceId,
          externalKey: latestDiscovery.externalKey,
          evidenceRefs: latestDiscovery.evidenceRefs,
          tags: latestDiscovery.tags,
        }
      : null,
    jobs: orderedJobs.map((job) => ({
      id: String(job._id),
      kind: job.kind,
      status: job.status,
      projectId: job.projectId,
      progress: job.progress
        ? {
            stage: job.progress.stage,
            message: job.progress.message,
            updatedAt: new Date(job.progress.updatedAtMs).toISOString(),
          }
        : null,
      updatedAt: new Date(job.updatedAtMs).toISOString(),
      error: job.error,
    })),
    projectIds,
    summary: summary.summary,
    summarySource: summary.source,
    concepts: dossier?.concepts ?? [],
    dossierId: dossier ? String(dossier._id) : undefined,
    resourceAssetId: asset ? String(asset._id) : undefined,
  };
}
