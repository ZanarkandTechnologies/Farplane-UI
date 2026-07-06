/**
 * RESOURCE BANK MAINTENANCE FUNCTIONS
 * ===================================
 * Ownership: Resource Bank Convex module.
 * Inputs: explicit operator reset confirmation and a previously captured snapshot summary.
 * Outputs: snapshot payloads or guarded reset receipts.
 * Side effects: reset deletes Resource Bank rows in dependency order after count verification.
 */

import { v } from "convex/values";
import { mutation, query } from "../../_generated/server";
import {
  backfillCreativeElementPinsArgsValidator,
  resetResourceBankAfterSnapshotArgsValidator,
} from "./validators";

const RESET_CONFIRMATION = "reset-resource-bank-after-snapshot";
const BACKFILL_CREATIVE_ELEMENT_PINS_CONFIRMATION = "backfill-creative-element-pins";

const countsMatch = (
  actual: {
    jobs: number;
    assets: number;
    analyses: number;
    skillFindings: number;
    creativeElements: number;
  },
  expected: {
    jobs: number;
    assets: number;
    analyses: number;
    skillFindings: number;
    creativeElements: number;
  },
) =>
  actual.jobs === expected.jobs &&
  actual.assets === expected.assets &&
  actual.analyses === expected.analyses &&
  actual.skillFindings === expected.skillFindings &&
  actual.creativeElements === expected.creativeElements;

export const snapshotResourceBank = query({
  args: {},
  handler: async (ctx) => {
    const [jobs, assets, analyses, skillFindings, creativeElements] = await Promise.all([
      ctx.db.query("resourceBankIngestionJobs").collect(),
      ctx.db.query("resourceBankAssets").collect(),
      ctx.db.query("resourceBankAnalyses").collect(),
      ctx.db.query("resourceBankSkillFindings").collect(),
      ctx.db.query("resourceBankCreativeElements").collect(),
    ]);
    return {
      snapshotCreatedAtMs: Date.now(),
      resetFunction: "modules/resourceBank/maintenance:resetResourceBankAfterSnapshot",
      requiredConfirm: RESET_CONFIRMATION,
      counts: {
        jobs: jobs.length,
        assets: assets.length,
        analyses: analyses.length,
        skillFindings: skillFindings.length,
        creativeElements: creativeElements.length,
      },
      rows: {
        jobs,
        assets,
        analyses,
        skillFindings,
        creativeElements,
      },
    };
  },
});

export const countResourceBankRows = query({
  args: {},
  handler: async (ctx) => {
    const [jobs, assets, analyses, skillFindings, creativeElements] = await Promise.all([
      ctx.db.query("resourceBankIngestionJobs").collect(),
      ctx.db.query("resourceBankAssets").collect(),
      ctx.db.query("resourceBankAnalyses").collect(),
      ctx.db.query("resourceBankSkillFindings").collect(),
      ctx.db.query("resourceBankCreativeElements").collect(),
    ]);
    return {
      jobs: jobs.length,
      assets: assets.length,
      analyses: analyses.length,
      skillFindings: skillFindings.length,
      creativeElements: creativeElements.length,
    };
  },
});

export const backfillCreativeElementPins = mutation({
  args: backfillCreativeElementPinsArgsValidator,
  returns: v.object({
    ok: v.boolean(),
    scanned: v.number(),
    updated: v.number(),
    remaining: v.number(),
    defaults: v.object({
      pinned: v.boolean(),
    }),
  }),
  handler: async (ctx, args) => {
    if (args.confirm !== BACKFILL_CREATIVE_ELEMENT_PINS_CONFIRMATION) {
      throw new Error("resource_bank_creative_element_pins_backfill_not_confirmed");
    }
    const limit = Math.max(1, Math.min(500, Math.floor(args.limit ?? 200)));
    const rows = await ctx.db.query("resourceBankCreativeElements").collect();
    const rowsNeedingBackfill = rows.filter((row) => row.pinned !== true);
    let updated = 0;
    for (const row of rowsNeedingBackfill.slice(0, limit)) {
      if (row.pinned !== true) {
        await ctx.db.patch(row._id, {
          pinned: true,
        });
        updated += 1;
      }
    }
    return {
      ok: true,
      scanned: rows.length,
      updated,
      remaining: Math.max(0, rowsNeedingBackfill.length - updated),
      defaults: {
        pinned: true,
      },
    };
  },
});

export const resetResourceBankAfterSnapshot = mutation({
  args: resetResourceBankAfterSnapshotArgsValidator,
  returns: v.object({
    ok: v.boolean(),
    deleted: v.object({
      jobs: v.number(),
      assets: v.number(),
      analyses: v.number(),
      skillFindings: v.number(),
      creativeElements: v.number(),
    }),
  }),
  handler: async (ctx, args) => {
    if (args.confirm !== RESET_CONFIRMATION) throw new Error("resource_bank_reset_not_confirmed");
    if (!Number.isFinite(args.snapshotCreatedAtMs) || args.snapshotCreatedAtMs <= 0) {
      throw new Error("resource_bank_reset_missing_snapshot_timestamp");
    }
    const [jobs, assets, analyses, skillFindings, creativeElements] = await Promise.all([
      ctx.db.query("resourceBankIngestionJobs").collect(),
      ctx.db.query("resourceBankAssets").collect(),
      ctx.db.query("resourceBankAnalyses").collect(),
      ctx.db.query("resourceBankSkillFindings").collect(),
      ctx.db.query("resourceBankCreativeElements").collect(),
    ]);
    const actualCounts = {
      jobs: jobs.length,
      assets: assets.length,
      analyses: analyses.length,
      skillFindings: skillFindings.length,
      creativeElements: creativeElements.length,
    };
    if (!countsMatch(actualCounts, args.expectedCounts)) {
      throw new Error(
        `resource_bank_reset_snapshot_count_mismatch:${JSON.stringify(actualCounts)}`,
      );
    }

    for (const row of creativeElements) await ctx.db.delete(row._id);
    for (const row of skillFindings) await ctx.db.delete(row._id);
    for (const row of analyses) await ctx.db.delete(row._id);
    for (const row of assets) await ctx.db.delete(row._id);
    for (const row of jobs) await ctx.db.delete(row._id);

    return { ok: true, deleted: actualCounts };
  },
});
