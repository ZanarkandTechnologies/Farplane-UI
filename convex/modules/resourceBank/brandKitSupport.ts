/**
 * RESOURCE BANK BRAND KIT SUPPORT
 * ===============================
 * Ownership: Resource Bank Brand Kit persistence helpers.
 * Inputs: Brand Kit rows, approved Resource Bank elements, and promotion metadata.
 * Outputs: hydrated kit views, immutable element snapshots, and promotion receipts.
 * Side effects: promotion writes update one Brand Kit row; candidate rows stay unchanged.
 */

import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { getAssetOrThrow, getJobOrThrow, nowMs, toBrandKitRow } from "./records";
import {
  type BrandKitRow,
  buildBrandKitIdempotencyHash,
  buildBrandKitSourceSnapshotHash,
  cleanText,
  mergeTags,
  requireCleanText,
} from "./resourceBank";

type BrandKit = Doc<"brandKits">;
type ResourceElement = Doc<"resourceBankCreativeElements">;
type ResourceAsset = Doc<"resourceBankAssets">;

type PromotionCandidate = {
  elementId: string;
  sourceSnapshotHash: string;
  provenance: {
    resourceElementId?: Id<"resourceBankCreativeElements">;
    idempotencyKeyHash?: string;
  };
};

export async function resolveBrandKit(
  ctx: Pick<QueryCtx | MutationCtx, "db">,
  args: { brandKitId?: Id<"brandKits">; kitId?: string },
): Promise<BrandKit | null> {
  if (args.brandKitId) return await ctx.db.get(args.brandKitId);
  const kitId = cleanText(args.kitId, 160);
  return kitId ? await findBrandKitByKitId(ctx, kitId) : null;
}

export async function findBrandKitByKitId(
  ctx: Pick<QueryCtx | MutationCtx, "db">,
  kitId: string,
): Promise<BrandKit | null> {
  return await ctx.db
    .query("brandKits")
    .withIndex("by_kitId", (q) => q.eq("kitId", kitId))
    .first();
}

export function assertActiveBrandKit(row: BrandKit): void {
  if (row.status !== "active") throw new Error("brand_kit_not_active");
}

export function assertBrandKitRevision(
  row: Pick<BrandKit, "revision">,
  expectedRevision: number | undefined,
): void {
  if (expectedRevision !== undefined && row.revision !== expectedRevision) {
    throw new Error("brand_kit_revision_mismatch");
  }
}

export function assertBrandKitPromptRevision(
  prompt: Pick<NonNullable<BrandKit["prompt"]>, "revision">,
  expectedRevision: number | undefined,
): void {
  if (expectedRevision !== undefined && prompt.revision !== expectedRevision) {
    throw new Error("brand_kit_prompt_revision_mismatch");
  }
}

export async function toBrandKitViewRow(ctx: QueryCtx, row: BrandKit) {
  const kit = toBrandKitRow(row);
  return {
    ...kit,
    elements: await Promise.all(
      kit.elements.map(async (element) => ({
        ...element,
        goldenExample: await hydrateBrandKitGoldenExample(ctx, element),
      })),
    ),
  };
}

export async function toBrandKitProductionRow(ctx: QueryCtx, row: BrandKit): Promise<BrandKitRow> {
  const view = await toBrandKitViewRow(ctx, row);
  const elements = view.elements.map((element) => {
    const description = requireCleanText(
      element.description,
      "brand_kit_production_description",
      2_000,
    );
    const whyItWorks = requireCleanText(
      element.whyItWorks,
      "brand_kit_production_why_it_works",
      2_000,
    );
    const goldenRecipe = requireCleanText(
      element.goldenRecipe,
      "brand_kit_production_golden_recipe",
      6_000,
    );
    return {
      elementId: element.elementId,
      kind: element.kind,
      title: element.title,
      description,
      whyItWorks,
      goldenExample: element.goldenExample,
      goldenRecipe,
      anchor: element.anchor,
      tags: element.tags,
      providerHandles: element.providerHandles,
      provenance: element.provenance,
      sourceSnapshotHash: element.sourceSnapshotHash,
      approvedAtMs: element.approvedAtMs,
      approvedBy: element.approvedBy,
    };
  });
  return {
    _id: view._id,
    kitId: view.kitId,
    projectId: view.projectId,
    slug: view.slug,
    name: view.name,
    description: view.description,
    status: view.status,
    revision: view.revision,
    elements,
    prompt: view.prompt,
    createdAtMs: view.createdAtMs,
    updatedAtMs: view.updatedAtMs,
    archivedAtMs: view.archivedAtMs,
  };
}

export async function promoteResourceElementIds(
  ctx: MutationCtx,
  row: BrandKit,
  args: {
    elementIds: Id<"resourceBankCreativeElements">[];
    operatorNote?: string;
    requestedBy?: string;
    idempotencyKey?: string;
  },
) {
  const timestamp = nowMs();
  const createdElementIds: string[] = [];
  const updatedElementIds: string[] = [];
  const dedupedElementIds: string[] = [];
  const sourceElementIds: Id<"resourceBankCreativeElements">[] = [];
  const nextElements = [...row.elements];
  for (const elementId of args.elementIds) {
    const element = await ctx.db.get(elementId);
    if (!element) throw new Error("brand_kit_resource_element_not_found");
    const asset = await getAssetOrThrow(ctx, element.goldenExample.assetId);
    await getJobOrThrow(ctx, element.ingestionJobId);
    if (asset.ingestionJobId !== element.ingestionJobId) {
      throw new Error("brand_kit_golden_example_asset_job_mismatch");
    }
    const snapshot = snapshotFromResourceElement({
      asset,
      element,
      operatorNote: args.operatorNote,
      promotedAtMs: timestamp,
      requestedBy: args.requestedBy,
      idempotencyKey: args.idempotencyKey,
    });
    sourceElementIds.push(elementId);
    const disposition = classifyBrandKitPromotion(nextElements, elementId, snapshot);
    if (disposition.action === "dedupe") {
      dedupedElementIds.push(disposition.elementId);
      continue;
    }
    if (disposition.action === "update") {
      nextElements[disposition.index] = snapshot;
      updatedElementIds.push(snapshot.elementId);
      continue;
    }
    nextElements.push(snapshot);
    createdElementIds.push(snapshot.elementId);
  }
  if (createdElementIds.length > 0 || updatedElementIds.length > 0) {
    await ctx.db.patch(row._id, {
      elements: nextElements,
      revision: row.revision + 1,
      updatedAtMs: timestamp,
    });
  }
  return promotionReceipt(
    row,
    createdElementIds,
    dedupedElementIds,
    sourceElementIds,
    updatedElementIds,
  );
}

export function classifyBrandKitPromotion(
  elements: readonly PromotionCandidate[],
  sourceElementId: Id<"resourceBankCreativeElements">,
  snapshot: PromotionCandidate,
):
  | { action: "dedupe"; elementId: string }
  | { action: "update"; index: number }
  | { action: "create" } {
  const exact = elements.find(
    (candidate) =>
      candidate.sourceSnapshotHash === snapshot.sourceSnapshotHash ||
      (snapshot.provenance.idempotencyKeyHash !== undefined &&
        candidate.provenance.idempotencyKeyHash === snapshot.provenance.idempotencyKeyHash),
  );
  if (exact) return { action: "dedupe", elementId: exact.elementId };
  const sourceIndex = elements.findIndex(
    (candidate) => candidate.provenance.resourceElementId === sourceElementId,
  );
  return sourceIndex >= 0 ? { action: "update", index: sourceIndex } : { action: "create" };
}

export function assertDisplayableGoldenExample(example: {
  title?: string;
  sourceUrl?: string;
  canonicalUrl?: string;
  storageId?: Id<"_storage">;
  localPath?: string;
  assetId?: Id<"resourceBankAssets">;
}): void {
  if (!cleanText(example.title, 240)) throw new Error("brand_kit_golden_example_title_required");
  if (
    !example.assetId &&
    !example.storageId &&
    !cleanText(example.sourceUrl, 2_000) &&
    !cleanText(example.canonicalUrl, 2_000) &&
    !cleanText(example.localPath, 2_000)
  ) {
    throw new Error("brand_kit_golden_example_locator_required");
  }
}

export function selectJobPromotionElements(elements: ResourceElement[]): ResourceElement[] {
  return elements.filter((element) => element.pinned);
}

export function compactGoldenExample(input: {
  title?: string;
  sourceUrl?: string;
  canonicalUrl?: string;
  storageId?: Id<"_storage">;
  localPath?: string;
  assetId?: Id<"resourceBankAssets">;
  description?: string;
}) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined && value !== ""),
  ) as {
    title?: string;
    sourceUrl?: string;
    canonicalUrl?: string;
    storageId?: Id<"_storage">;
    localPath?: string;
    assetId?: Id<"resourceBankAssets">;
    description?: string;
  };
}

export function promotionReceipt(
  row: BrandKit,
  createdElementIds: string[],
  dedupedElementIds: string[],
  sourceElementIds: Id<"resourceBankCreativeElements">[],
  updatedElementIds: string[] = [],
) {
  const changed = createdElementIds.length > 0 || updatedElementIds.length > 0;
  return {
    brandKitId: row.kitId,
    revisionBefore: row.revision,
    revisionAfter: changed ? row.revision + 1 : row.revision,
    createdElementIds,
    updatedElementIds,
    dedupedElementIds,
    sourceElementIds,
  };
}

function snapshotFromResourceElement(input: {
  asset: ResourceAsset;
  element: ResourceElement;
  operatorNote?: string;
  promotedAtMs: number;
  requestedBy?: string;
  idempotencyKey?: string;
}) {
  const kind = input.element.kind;
  const title = cleanText(input.element.title, 240) ?? "Untitled brand element";
  const description = requireCleanText(input.element.description, "brand_kit_description", 2_000);
  const whyItWorks = requireCleanText(input.element.whyItWorks, "brand_kit_why_it_works", 2_000);
  const goldenRecipe = requireCleanText(
    input.element.goldenRecipe,
    "brand_kit_golden_recipe",
    6_000,
  );
  const tags = mergeTags(input.element.tags, input.operatorNote ? ["source:operator-note"] : []);
  const exampleAssetId = input.element.goldenExample.assetId;
  const example = compactGoldenExample({
    title: cleanText(input.asset.title, 240),
    sourceUrl: input.asset.sourceUrl,
    canonicalUrl: input.asset.canonicalUrl,
    storageId: input.asset.storageId,
    localPath: input.asset.localPath,
    assetId: exampleAssetId,
    description: cleanText(input.element.goldenExample.description, 1_000),
  });
  assertDisplayableGoldenExample(example);
  const sourceSnapshotHash = buildBrandKitSourceSnapshotHash({
    kind,
    title,
    description,
    whyItWorks,
    goldenExample: example,
    goldenRecipe,
    anchor: input.element.anchor,
    tags,
  });
  const idempotencyKeyHash = buildBrandKitIdempotencyHash(input.idempotencyKey, sourceSnapshotHash);
  return {
    elementId: `resource:${sourceSnapshotHash}`,
    kind,
    title,
    description,
    whyItWorks,
    goldenExample: example,
    goldenRecipe,
    anchor: cleanText(input.element.anchor, 500),
    tags,
    provenance: {
      resourceElementId: input.element._id,
      ingestionJobId: input.element.ingestionJobId,
      assetId: input.element.assetId,
      analysisId: input.element.analysisId,
      promotedFrom: "resource_bank" as const,
      promotedBy: cleanText(input.requestedBy, 120),
      promotedAtMs: input.promotedAtMs,
      idempotencyKeyHash,
    },
    sourceSnapshotHash,
    approvedAtMs: input.promotedAtMs,
    approvedBy: cleanText(input.requestedBy, 120),
  };
}

async function hydrateBrandKitGoldenExample(ctx: QueryCtx, element: BrandKit["elements"][number]) {
  return {
    ...element.goldenExample,
    storageUrl: element.goldenExample.storageId
      ? await ctx.storage.getUrl(element.goldenExample.storageId)
      : null,
  };
}
