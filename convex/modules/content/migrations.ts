/**
 * Confirmation-gated, idempotent migration from the legacy Resource Bank job table.
 * It creates generic source/job records first, then separately removes only proven Vidgard rows.
 */
import { v } from "convex/values";
import { mutation, query } from "../../_generated/server";
import { ensureContentSource } from "./records";
import { timelineDayFromMs } from "./timeline";

const MAX_BATCH = 10;
const MIGRATE_CONFIRMATION = "migrate-resource-bank-content-jobs";
const DELETE_CONFIRMATION = "delete-migrated-vidgard-resource-assets";
const CLEAR_DOSSIER_CONFIRMATION = "clear-migrated-vidgard-legacy-dossier-links";

export const previewLegacyResourceBankMigration = query({
  args: {},
  returns: v.object({
    scanned: v.number(),
    pending: v.number(),
    vidgard: v.number(),
    saved: v.number(),
  }),
  handler: async (ctx) => {
    const rows = await ctx.db.query("resourceBankIngestionJobs").take(250);
    const pending = rows.filter((row) => !row.contentJobId);
    return {
      scanned: rows.length,
      pending: pending.length,
      vidgard: pending.filter(isLegacyVidgardJob).length,
      saved: pending.filter((row) => !isLegacyVidgardJob(row)).length,
    };
  },
});

export const migrateLegacyResourceBankBatch = mutation({
  args: { confirm: v.string(), limit: v.optional(v.number()) },
  returns: v.object({ migrated: v.number(), remainingHint: v.number() }),
  handler: async (ctx, args) => {
    if (args.confirm !== MIGRATE_CONFIRMATION) throw new Error("content_migration_not_confirmed");
    const limit = boundedLimit(args.limit);
    const candidates = await ctx.db
      .query("resourceBankIngestionJobs")
      .withIndex("by_contentJobId", (q) => q.eq("contentJobId", undefined))
      .take(limit);
    for (const legacyJob of candidates) {
      const assets = await ctx.db
        .query("resourceBankAssets")
        .withIndex("by_job", (q) => q.eq("ingestionJobId", legacyJob._id))
        .take(101);
      if (assets.length > 100) throw new Error("content_migration_asset_overflow");
      const primary = assets.find((asset) => asset.assetRole === "primary");
      const sourceRef = primary?.canonicalUrl ?? primary?.sourceUrl ?? legacyJob.sourceRef;
      const sourceId = await ensureContentSource(ctx, {
        sourceKind: legacyJob.sourceKind,
        sourceRef,
        canonicalRef: sourceRef,
        title: primary?.title,
        platform: primary?.platform,
        sourcePrivacy: legacyJob.sourcePrivacy,
        now: Date.now(),
        timelineDay: timelineDayFromMs(legacyJob.updatedAtMs),
      });
      const contentJobId = await ctx.db.insert("contentJobs", {
        sourceId,
        kind: isLegacyVidgardJob(legacyJob) ? "analyze_youtube" : "save_reference",
        originalInstruction: legacyJob.originalInstruction,
        note: legacyJob.note,
        requestedFocus: legacyJob.requestedFocus,
        brandKitId: legacyJob.brandKitId,
        sourceScope: legacyJob.sourceScope,
        tags: legacyJob.tags,
        projectId: legacyJob.projectId,
        taskId: legacyJob.taskId,
        externalTaskRef: legacyJob.externalTaskRef,
        requestedBy: legacyJob.requestedBy,
        status: legacyJob.status,
        error: legacyJob.error,
        createdAtMs: legacyJob.createdAtMs,
        updatedAtMs: legacyJob.updatedAtMs,
        completedAtMs: legacyJob.completedAtMs,
        legacyResourceBankJobId: legacyJob._id,
      });
      await ctx.db.patch(legacyJob._id, { contentSourceId: sourceId, contentJobId });
      await Promise.all(
        assets.map((asset) => ctx.db.patch(asset._id, { contentSourceId: sourceId, contentJobId })),
      );
      const [analyses, findings, elements, dossiers] = await Promise.all([
        ctx.db
          .query("resourceBankAnalyses")
          .withIndex("by_job", (q) => q.eq("ingestionJobId", legacyJob._id))
          .take(101),
        ctx.db
          .query("resourceBankSkillFindings")
          .withIndex("by_job", (q) => q.eq("ingestionJobId", legacyJob._id))
          .take(101),
        ctx.db
          .query("resourceBankCreativeElements")
          .withIndex("by_job", (q) => q.eq("ingestionJobId", legacyJob._id))
          .take(101),
        ctx.db
          .query("videoIntelligenceDossiers")
          .withIndex("by_resourceJobId", (q) => q.eq("resourceJobId", legacyJob._id))
          .take(11),
      ]);
      if (
        [analyses, findings, elements].some((rows) => rows.length > 100) ||
        dossiers.length > 10
      ) {
        throw new Error("content_migration_dependent_overflow");
      }
      await Promise.all([
        ...analyses.map((row) => ctx.db.patch(row._id, { contentJobId })),
        ...findings.map((row) => ctx.db.patch(row._id, { contentJobId })),
        ...elements.map((row) => ctx.db.patch(row._id, { contentJobId })),
        ...dossiers.map((row) =>
          ctx.db.patch(row._id, { contentSourceId: sourceId, contentJobId }),
        ),
      ]);
      const kits = await ctx.db.query("brandKits").take(100);
      const assetsById = new Map(assets.map((asset) => [String(asset._id), asset]));
      await Promise.all(
        kits.flatMap((kit) => {
          let changed = false;
          const elements = kit.elements.map((element) => {
            if (element.provenance.ingestionJobId !== legacyJob._id) return element;
            changed = true;
            const sourceAsset = element.provenance.assetId
              ? assetsById.get(String(element.provenance.assetId))
              : undefined;
            return {
              ...element,
              goldenExample: {
                ...element.goldenExample,
                assetId: undefined,
                sourceUrl: element.goldenExample.sourceUrl ?? sourceAsset?.sourceUrl,
                canonicalUrl: element.goldenExample.canonicalUrl ?? sourceAsset?.canonicalUrl,
                storageId: element.goldenExample.storageId ?? sourceAsset?.storageId,
                localPath: element.goldenExample.localPath ?? sourceAsset?.localPath,
                title: element.goldenExample.title ?? sourceAsset?.title,
              },
              provenance: {
                ...element.provenance,
                resourceElementId: undefined,
                ingestionJobId: undefined,
                assetId: undefined,
                analysisId: undefined,
                contentJobId,
              },
            };
          });
          return changed ? [ctx.db.patch(kit._id, { elements })] : [];
        }),
      );
    }
    return { migrated: candidates.length, remainingHint: candidates.length === limit ? limit : 0 };
  },
});

export const deleteMigratedVidgardLegacyRows = mutation({
  args: { confirm: v.string(), limit: v.optional(v.number()) },
  returns: v.object({ deleted: v.number(), remainingHint: v.number() }),
  handler: async (ctx, args) => {
    if (args.confirm !== DELETE_CONFIRMATION)
      throw new Error("content_legacy_delete_not_confirmed");
    const limit = boundedLimit(args.limit);
    const candidates = (await ctx.db.query("resourceBankIngestionJobs").take(250))
      .filter((job) => isLegacyVidgardJob(job) && job.contentJobId && job.contentSourceId)
      .slice(0, limit);
    for (const legacyJob of candidates) {
      const contentJobId = legacyJob.contentJobId;
      if (!contentJobId) throw new Error("content_legacy_delete_binding_invalid");
      const [contentJob, dossiers, kits, assets, analyses, findings, elements] = await Promise.all([
        ctx.db.get(contentJobId),
        ctx.db
          .query("videoIntelligenceDossiers")
          .withIndex("by_resourceJobId", (q) => q.eq("resourceJobId", legacyJob._id))
          .take(10),
        ctx.db.query("brandKits").take(100),
        ctx.db
          .query("resourceBankAssets")
          .withIndex("by_job", (q) => q.eq("ingestionJobId", legacyJob._id))
          .take(101),
        ctx.db
          .query("resourceBankAnalyses")
          .withIndex("by_job", (q) => q.eq("ingestionJobId", legacyJob._id))
          .take(101),
        ctx.db
          .query("resourceBankSkillFindings")
          .withIndex("by_job", (q) => q.eq("ingestionJobId", legacyJob._id))
          .take(101),
        ctx.db
          .query("resourceBankCreativeElements")
          .withIndex("by_job", (q) => q.eq("ingestionJobId", legacyJob._id))
          .take(101),
      ]);
      if (
        [assets, analyses, findings, elements].some((rows) => rows.length > 100) ||
        dossiers.length > 10
      ) {
        throw new Error("content_legacy_delete_dependent_overflow");
      }
      if (
        !contentJob ||
        contentJob.kind !== "analyze_youtube" ||
        contentJob.sourceId !== legacyJob.contentSourceId
      ) {
        throw new Error("content_legacy_delete_generic_binding_missing");
      }
      if (
        dossiers.some(
          (dossier) =>
            dossier.contentJobId !== contentJob._id ||
            dossier.contentSourceId !== contentJob.sourceId,
        )
      ) {
        throw new Error("content_legacy_delete_dossier_not_relinked");
      }
      if (
        kits.some((kit) =>
          kit.elements.some(
            (element) =>
              element.provenance.ingestionJobId === legacyJob._id ||
              (element.provenance.contentJobId === contentJob._id &&
                (element.provenance.resourceElementId ||
                  element.provenance.assetId ||
                  element.provenance.analysisId)),
          ),
        )
      ) {
        throw new Error("content_legacy_delete_brand_kit_not_relinked");
      }
      const assetIds = new Set(assets.map((row) => String(row._id)));
      const analysisIds = new Set(analyses.map((row) => String(row._id)));
      const elementIds = new Set(elements.map((row) => String(row._id)));
      if (
        kits.some((kit) =>
          kit.elements.some(
            (element) =>
              assetIds.has(String(element.provenance.assetId)) ||
              analysisIds.has(String(element.provenance.analysisId)) ||
              elementIds.has(String(element.provenance.resourceElementId)),
          ),
        )
      )
        throw new Error("content_legacy_delete_brand_kit_dangling_reference");
      await Promise.all([
        ...elements.map((row) => ctx.db.delete(row._id)),
        ...findings.map((row) => ctx.db.delete(row._id)),
        ...analyses.map((row) => ctx.db.delete(row._id)),
      ]);
      await Promise.all(assets.map((row) => ctx.db.delete(row._id)));
      await ctx.db.delete(legacyJob._id);
    }
    return { deleted: candidates.length, remainingHint: candidates.length === limit ? limit : 0 };
  },
});

/** Removes stale optional Resource Bank foreign keys after their source rows have been deleted. */
export const clearMigratedVidgardLegacyDossierLinks = mutation({
  args: { confirm: v.string(), limit: v.optional(v.number()) },
  returns: v.object({ cleared: v.number(), remainingHint: v.number() }),
  handler: async (ctx, args) => {
    if (args.confirm !== CLEAR_DOSSIER_CONFIRMATION) {
      throw new Error("content_legacy_dossier_clear_not_confirmed");
    }
    const limit = boundedLimit(args.limit);
    const candidates = (await ctx.db.query("videoIntelligenceDossiers").take(250))
      .filter(
        (dossier) =>
          dossier.contentJobId &&
          dossier.contentSourceId &&
          (dossier.resourceAssetId || dossier.resourceJobId),
      )
      .slice(0, limit);
    for (const dossier of candidates) {
      const contentJobId = dossier.contentJobId;
      if (!contentJobId) throw new Error("content_legacy_dossier_clear_binding_invalid");
      const contentJob = await ctx.db.get(contentJobId);
      if (
        !contentJob ||
        contentJob.kind !== "analyze_youtube" ||
        contentJob.sourceId !== dossier.contentSourceId
      ) {
        throw new Error("content_legacy_dossier_clear_binding_invalid");
      }
      await ctx.db.patch(dossier._id, { resourceAssetId: undefined, resourceJobId: undefined });
    }
    return { cleared: candidates.length, remainingHint: candidates.length === limit ? limit : 0 };
  },
});

function boundedLimit(value: number | undefined): number {
  return Math.max(1, Math.min(Math.floor(value ?? MAX_BATCH), MAX_BATCH));
}

function isLegacyVidgardJob(job: { requestedBy?: string; sourceRef: string }): boolean {
  return job.requestedBy === "farplane-youtube-shortcut" && isYouTubeUrl(job.sourceRef);
}

function isYouTubeUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return /(^|\.)youtube\.com$|(^|\.)youtu\.be$/i.test(url.hostname);
  } catch {
    return false;
  }
}
