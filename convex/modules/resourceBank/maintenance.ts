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
import { resetResourceBankAfterSnapshotArgsValidator } from "./validators";

const RESET_CONFIRMATION = "reset-resource-bank-after-snapshot";

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
      throw new Error(`resource_bank_reset_snapshot_count_mismatch:${JSON.stringify(actualCounts)}`);
    }

    for (const row of creativeElements) await ctx.db.delete(row._id);
    for (const row of skillFindings) await ctx.db.delete(row._id);
    for (const row of analyses) await ctx.db.delete(row._id);
    for (const row of assets) await ctx.db.delete(row._id);
    for (const row of jobs) await ctx.db.delete(row._id);

    return { ok: true, deleted: actualCounts };
  },
});
