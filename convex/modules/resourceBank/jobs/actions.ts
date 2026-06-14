/**
 * RESOURCE BANK JOB ACTIONS
 * ==========================
 * Ownership: Resource Bank Convex module.
 * Inputs: ingestion requests and task/project links.
 * Outputs: ingestion job rows and job status updates.
 * Side effects: writes `resourceBankIngestionJobs` and propagates lightweight task links to assets.
 */

import { v } from "convex/values";
import { mutation } from "../../../_generated/server";
import { cleanText, normalizeTags } from "../resourceBank";
import { getJobOrThrow, nowMs } from "../shared/records";
import {
  completeIngestionJobArgsValidator,
  createIngestionJobArgsValidator,
  linkJobToTaskArgsValidator,
} from "../validators";

export const createIngestionJob = mutation({
  args: createIngestionJobArgsValidator,
  returns: v.id("resourceBankIngestionJobs"),
  handler: async (ctx, args) => {
    const timestamp = nowMs();
    const sourceRef = cleanText(args.sourceRef, 2_000);
    if (!sourceRef) throw new Error("missing_source_ref");
    return await ctx.db.insert("resourceBankIngestionJobs", {
      sourceKind: args.sourceKind,
      sourceRef,
      originalInstruction: cleanText(args.originalInstruction, 2_000),
      note: cleanText(args.note, 2_000),
      requestedFocus: cleanText(args.requestedFocus, 500),
      sourceScope: args.sourceScope,
      tags: normalizeTags(args.tags),
      projectId: cleanText(args.projectId, 120),
      taskId: cleanText(args.taskId, 120),
      externalTaskRef: cleanText(args.externalTaskRef, 500),
      requestedBy: cleanText(args.requestedBy, 120),
      status: "queued",
      sourcePrivacy: args.sourcePrivacy ?? "unknown",
      createdAtMs: timestamp,
      updatedAtMs: timestamp,
    });
  },
});

export const completeIngestionJob = mutation({
  args: completeIngestionJobArgsValidator,
  returns: v.object({ ok: v.boolean(), jobId: v.id("resourceBankIngestionJobs") }),
  handler: async (ctx, args) => {
    await getJobOrThrow(ctx, args.jobId);
    const timestamp = nowMs();
    await ctx.db.patch(args.jobId, {
      status: args.status ?? "ready",
      error: cleanText(args.error, 2_000),
      updatedAtMs: timestamp,
      completedAtMs: args.status === "failed" ? undefined : timestamp,
    });
    return { ok: true, jobId: args.jobId };
  },
});

export const linkJobToTask = mutation({
  args: linkJobToTaskArgsValidator,
  returns: v.object({ ok: v.boolean(), jobId: v.id("resourceBankIngestionJobs") }),
  handler: async (ctx, args) => {
    await getJobOrThrow(ctx, args.jobId);
    const projectId = cleanText(args.projectId, 120);
    const taskId = cleanText(args.taskId, 120);
    await ctx.db.patch(args.jobId, {
      projectId,
      taskId,
      externalTaskRef: cleanText(args.externalTaskRef, 500),
      updatedAtMs: nowMs(),
    });
    const assets = await ctx.db
      .query("resourceBankAssets")
      .withIndex("by_job", (q) => q.eq("ingestionJobId", args.jobId))
      .take(100);
    for (const asset of assets) {
      await ctx.db.patch(asset._id, { projectId, taskId, updatedAtMs: nowMs() });
    }
    return { ok: true, jobId: args.jobId };
  },
});
