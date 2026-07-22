/**
 * RESOURCE BANK BRAND KIT FUNCTIONS
 * =================================
 * Ownership: Resource Bank Convex module.
 * Inputs: approved creative identity kit metadata and Resource Bank element ids.
 * Outputs: Brand Kit rows, promotion receipts, and production resolver packets.
 * Side effects: writes `brandKits`; Resource Bank rows remain candidate provenance.
 */

import { v } from "convex/values";
import { mutation, query } from "../../_generated/server";
import { getBrandKitOrThrow, getJobOrThrow, nowMs, toBrandKitRow } from "./records";
import {
  assertActiveBrandKit,
  assertBrandKitPromptRevision,
  assertBrandKitRevision,
  assertDisplayableGoldenExample,
  compactGoldenExample,
  findBrandKitByKitId,
  promoteResourceElementIds,
  promotionReceipt,
  resolveBrandKit,
  selectJobPromotionElements,
  toBrandKitProductionRow,
  toBrandKitViewRow,
} from "./brandKitSupport";
import {
  assertSafeProviderHandles,
  buildBrandKitIdempotencyHash,
  buildBrandKitProductionSnapshot,
  clampLimit,
  cleanText,
  mergeTags,
  normalizeBrandKitId,
  normalizeBrandKitPromptInput,
  normalizeBrandKitSlug,
  requireCleanText,
  stableHash,
} from "./resourceBank";
import {
  addManualBrandKitElementArgsValidator,
  archiveBrandKitArgsValidator,
  createBrandKitArgsValidator,
  getBrandKitArgsValidator,
  getBrandKitForProductionArgsValidator,
  listBrandKitsArgsValidator,
  promoteIngestionJobToBrandKitArgsValidator,
  promoteResourceElementsToBrandKitArgsValidator,
  updateBrandKitArgsValidator,
  updateBrandKitPromptArgsValidator,
} from "./validators";

export const createBrandKit = mutation({
  args: createBrandKitArgsValidator,
  returns: v.id("brandKits"),
  handler: async (ctx, args) => {
    const timestamp = nowMs();
    const name = cleanText(args.name, 240) ?? "Untitled Brand Kit";
    const kitId = normalizeBrandKitId(args.kitId ?? name);
    const slug = normalizeBrandKitSlug(args.kitId ?? name);
    if (!kitId || !slug) throw new Error("brand_kit_invalid_id");
    const existing = await findBrandKitByKitId(ctx, kitId);
    if (existing) throw new Error("brand_kit_id_already_exists");
    return await ctx.db.insert("brandKits", {
      kitId,
      projectId: cleanText(args.projectId, 120),
      slug,
      name,
      description: cleanText(args.description, 2_000),
      status: "active",
      revision: 1,
      elements: [],
      prompt: {
        text: "",
        revision: 1,
        updatedAtMs: timestamp,
      },
      createdAtMs: timestamp,
      updatedAtMs: timestamp,
    });
  },
});

export const listBrandKits = query({
  args: listBrandKitsArgsValidator,
  handler: async (ctx, args) => {
    const limit = clampLimit(args.limit, 40, 120);
    const queryText = cleanText(args.query, 240)?.toLowerCase();
    const rows = args.projectId
      ? await ctx.db
          .query("brandKits")
          .withIndex("by_project_updatedAtMs", (q) => q.eq("projectId", args.projectId))
          .order("desc")
          .take(limit * 3)
      : args.includeArchived
        ? await ctx.db
            .query("brandKits")
            .order("desc")
            .take(limit * 3)
        : await ctx.db
            .query("brandKits")
            .withIndex("by_status_updatedAtMs", (q) => q.eq("status", "active"))
            .order("desc")
            .take(limit * 3);
    const filtered = rows
      .filter((row) => args.includeArchived || row.status === "active")
      .filter((row) =>
        queryText
          ? `${row.name}\n${row.description ?? ""}\n${row.kitId}`.toLowerCase().includes(queryText)
          : true,
      )
      .slice(0, limit);
    return await Promise.all(filtered.map((row) => toBrandKitViewRow(ctx, row)));
  },
});

export const getBrandKit = query({
  args: getBrandKitArgsValidator,
  handler: async (ctx, args) => {
    const row = await resolveBrandKit(ctx, args);
    return row ? await toBrandKitViewRow(ctx, row) : null;
  },
});

export const updateBrandKit = mutation({
  args: updateBrandKitArgsValidator,
  handler: async (ctx, args) => {
    const row = await getBrandKitOrThrow(ctx, args.brandKitId);
    assertBrandKitRevision(row, args.expectedRevision);
    const patch = {
      name: cleanText(args.name, 240) ?? row.name,
      description:
        args.description === undefined ? row.description : cleanText(args.description, 2_000),
      projectId: args.projectId === undefined ? row.projectId : cleanText(args.projectId, 120),
      revision: row.revision + 1,
      updatedAtMs: nowMs(),
    };
    await ctx.db.patch(args.brandKitId, patch);
    return toBrandKitRow(await getBrandKitOrThrow(ctx, args.brandKitId));
  },
});

export const archiveBrandKit = mutation({
  args: archiveBrandKitArgsValidator,
  returns: v.object({
    ok: v.boolean(),
    brandKitId: v.id("brandKits"),
    revision: v.number(),
  }),
  handler: async (ctx, args) => {
    const row = await getBrandKitOrThrow(ctx, args.brandKitId);
    assertBrandKitRevision(row, args.expectedRevision);
    const timestamp = nowMs();
    await ctx.db.patch(args.brandKitId, {
      status: "archived",
      archivedAtMs: timestamp,
      revision: row.revision + 1,
      updatedAtMs: timestamp,
    });
    return { ok: true, brandKitId: args.brandKitId, revision: row.revision + 1 };
  },
});

export const updateBrandKitPrompt = mutation({
  args: updateBrandKitPromptArgsValidator,
  handler: async (ctx, args) => {
    const row = await getBrandKitOrThrow(ctx, args.brandKitId);
    assertActiveBrandKit(row);
    assertBrandKitRevision(row, args.expectedKitRevision);
    const currentPrompt = row.prompt;
    assertBrandKitPromptRevision(currentPrompt, args.expectedPromptRevision);
    const timestamp = nowMs();
    const prompt = normalizeBrandKitPromptInput({ text: args.text }, currentPrompt, timestamp);
    await ctx.db.patch(args.brandKitId, {
      prompt,
      revision: row.revision + 1,
      updatedAtMs: timestamp,
    });
    return {
      brandKitId: row.kitId,
      kitRevision: row.revision + 1,
      promptRevision: prompt.revision,
      updatedAtMs: prompt.updatedAtMs,
    };
  },
});

export const addManualBrandKitElement = mutation({
  args: addManualBrandKitElementArgsValidator,
  handler: async (ctx, args) => {
    const row = await getBrandKitOrThrow(ctx, args.brandKitId);
    assertActiveBrandKit(row);
    assertBrandKitRevision(row, args.expectedRevision);
    assertSafeProviderHandles(args.providerHandles ?? []);
    const timestamp = nowMs();
    const title = cleanText(args.title, 240) ?? "Untitled brand element";
    const description = requireCleanText(args.description, "brand_kit_description", 2_000);
    const whyItWorks = requireCleanText(args.whyItWorks, "brand_kit_why_it_works", 2_000);
    const goldenRecipe = requireCleanText(args.goldenRecipe, "brand_kit_golden_recipe", 6_000);
    const tags = mergeTags(args.tags);
    const goldenExample = compactGoldenExample({
      ...args.goldenExample,
      description: cleanText(args.goldenExample.description, 1_000),
    });
    assertDisplayableGoldenExample(goldenExample);
    const sourceSnapshotHash = stableHash({
      kind: args.kind,
      title,
      description,
      whyItWorks,
      goldenExample,
      goldenRecipe,
      anchor: args.anchor,
      tags,
      providerHandles: args.providerHandles ?? [],
    });
    const idempotencyKeyHash = buildBrandKitIdempotencyHash(
      args.idempotencyKey,
      sourceSnapshotHash,
    );
    const existing = row.elements.find(
      (element) =>
        element.sourceSnapshotHash === sourceSnapshotHash ||
        (idempotencyKeyHash !== undefined &&
          element.provenance.idempotencyKeyHash === idempotencyKeyHash),
    );
    if (existing) return promotionReceipt(row, [], [existing.elementId], []);
    const snapshot = {
      elementId: `manual:${sourceSnapshotHash}`,
      kind: args.kind,
      title,
      description,
      whyItWorks,
      goldenExample,
      goldenRecipe,
      anchor: cleanText(args.anchor, 500),
      tags,
      providerHandles: args.providerHandles,
      provenance: {
        promotedFrom: "manual" as const,
        promotedBy: cleanText(args.requestedBy, 120),
        promotedAtMs: timestamp,
        idempotencyKeyHash,
      },
      sourceSnapshotHash,
      approvedAtMs: timestamp,
      approvedBy: cleanText(args.requestedBy, 120),
    };
    await ctx.db.patch(args.brandKitId, {
      elements: [...row.elements, snapshot],
      revision: row.revision + 1,
      updatedAtMs: timestamp,
    });
    return promotionReceipt(row, [snapshot.elementId], [], []);
  },
});

export const promoteResourceElementsToBrandKit = mutation({
  args: promoteResourceElementsToBrandKitArgsValidator,
  handler: async (ctx, args) => {
    const row = await resolveBrandKit(ctx, args);
    if (!row) throw new Error("brand_kit_not_found");
    assertActiveBrandKit(row);
    return await promoteResourceElementIds(ctx, row, {
      elementIds: args.elementIds,
      operatorNote: args.operatorNote,
      requestedBy: args.requestedBy,
      idempotencyKey: args.idempotencyKey,
    });
  },
});

export const promoteIngestionJobToBrandKit = mutation({
  args: promoteIngestionJobToBrandKitArgsValidator,
  handler: async (ctx, args) => {
    const job = await getJobOrThrow(ctx, args.ingestionJobId);
    const row = await resolveBrandKit(ctx, {
      brandKitId: args.brandKitId,
      kitId: args.kitId ?? job.brandKitId,
    });
    if (!row) throw new Error("brand_kit_not_found");
    assertActiveBrandKit(row);
    const explicitElementIds = args.elementIds ?? [];
    const elements =
      explicitElementIds.length > 0
        ? await Promise.all(
            explicitElementIds.map(async (elementId) => {
              const element = await ctx.db.get(elementId);
              if (!element) throw new Error("brand_kit_resource_element_not_found");
              if (element.ingestionJobId !== args.ingestionJobId) {
                throw new Error("brand_kit_resource_element_job_mismatch");
              }
              return element;
            }),
          )
        : await ctx.db
            .query("resourceBankCreativeElements")
            .withIndex("by_job", (q) => q.eq("ingestionJobId", args.ingestionJobId))
            .collect();
    const selectedElements =
      explicitElementIds.length > 0 ? elements : selectJobPromotionElements(elements);
    if (selectedElements.length === 0) {
      return promotionReceipt(row, [], [], []);
    }
    return await promoteResourceElementIds(ctx, row, {
      elementIds: selectedElements.map((element) => element._id),
      operatorNote: args.operatorNote ?? job.note,
      requestedBy: args.requestedBy ?? job.requestedBy,
      idempotencyKey: args.idempotencyKey,
    });
  },
});

export const getBrandKitForProduction = query({
  args: getBrandKitForProductionArgsValidator,
  handler: async (ctx, args) => {
    const row = await findBrandKitByKitId(ctx, args.brandKitId);
    if (!row || row.status !== "active") throw new Error("brand_kit_not_found");
    return {
      ...buildBrandKitProductionSnapshot({
        kit: await toBrandKitProductionRow(ctx, row),
        snapshotCreatedAtMs: nowMs(),
      }),
      provenanceSummary: {
        resourceElementIds: row.elements
          .map((element) => element.provenance.resourceElementId)
          .filter(Boolean),
        ingestionJobIds: [
          ...new Set(
            row.elements.map((element) => element.provenance.ingestionJobId).filter(Boolean),
          ),
        ],
        assetIds: [
          ...new Set(row.elements.map((element) => element.provenance.assetId).filter(Boolean)),
        ],
      },
    };
  },
});

export { assertBrandKitPromptRevision, assertBrandKitRevision } from "./brandKitSupport";
