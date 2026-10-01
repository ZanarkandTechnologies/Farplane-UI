// Metric readings: record them (internal mutations, reached over the token-checked `/metrics/readings`
// route or `npx convex run`), read each metric's latest reading, and read one metric's history.
import { ConvexError, v } from "convex/values";
import type { Doc } from "../../_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "../../_generated/server";
import { MAX_BATCH, normalizeReading } from "./model";
import {
  historyArgsValidator,
  latestArgsValidator,
  type MetricReadingInput,
  metricReadingFields,
  recordReadingsArgsValidator,
  recordResultValidator,
  storedReadingValidator,
} from "./validators";

const MAX_METRICS = 500;
const DEFAULT_HISTORY = 500;
const MAX_HISTORY = 2000;

/** Inserts the reading, or replaces the one already recorded for the same project, metric and time. */
async function upsertReading(ctx: MutationCtx, input: MetricReadingInput): Promise<"inserted" | "updated"> {
  const reading = normalizeReading(input);
  const existing = await ctx.db
    .query("metricReadings")
    .withIndex("by_project_metric_at", (q) =>
      q.eq("project", reading.project).eq("metric", reading.metric).eq("at", reading.at),
    )
    .first();
  if (existing) {
    await ctx.db.replace(existing._id, reading);
    return "updated";
  }
  await ctx.db.insert("metricReadings", reading);
  return "inserted";
}

async function recordAll(ctx: MutationCtx, readings: MetricReadingInput[]) {
  if (readings.length > MAX_BATCH) throw new ConvexError(`at most ${MAX_BATCH} readings per call`);
  let inserted = 0;
  let updated = 0;
  for (const reading of readings) {
    if ((await upsertReading(ctx, reading)) === "inserted") inserted += 1;
    else updated += 1;
  }
  return { inserted, updated };
}

export const recordReading = internalMutation({
  args: metricReadingFields,
  returns: recordResultValidator,
  handler: async (ctx, args) => await recordAll(ctx, [args]),
});

export const recordReadings = internalMutation({
  args: recordReadingsArgsValidator,
  returns: recordResultValidator,
  handler: async (ctx, args) => await recordAll(ctx, args.readings),
});

/** The latest reading of every metric of one project, by an index skip-scan (one lookup per metric). */
async function latestForProject(ctx: QueryCtx, project: string, budget: number) {
  const out: Doc<"metricReadings">[] = [];
  let next = await ctx.db
    .query("metricReadings")
    .withIndex("by_project_metric_at", (q) => q.eq("project", project))
    .first();
  while (next && out.length < budget) {
    const metric: string = next.metric;
    const latest = await ctx.db
      .query("metricReadings")
      .withIndex("by_project_metric_at", (q) => q.eq("project", project).eq("metric", metric))
      .order("desc")
      .first();
    if (latest) out.push(latest);
    next = await ctx.db
      .query("metricReadings")
      .withIndex("by_project_metric_at", (q) => q.eq("project", project).gt("metric", metric))
      .first();
  }
  return out;
}

export const latest = internalQuery({
  args: latestArgsValidator,
  returns: v.array(storedReadingValidator),
  handler: async (ctx, args) => {
    const project = args.project?.trim();
    if (project) return await latestForProject(ctx, project, MAX_METRICS);
    const out: Doc<"metricReadings">[] = [];
    let next = await ctx.db.query("metricReadings").withIndex("by_project_metric_at").first();
    while (next && out.length < MAX_METRICS) {
      const current: string = next.project;
      out.push(...(await latestForProject(ctx, current, MAX_METRICS - out.length)));
      next = await ctx.db
        .query("metricReadings")
        .withIndex("by_project_metric_at", (q) => q.gt("project", current))
        .first();
    }
    return out;
  },
});

export const history = internalQuery({
  args: historyArgsValidator,
  returns: v.array(storedReadingValidator),
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(MAX_HISTORY, Math.floor(args.limit ?? DEFAULT_HISTORY)));
    const since = args.since ?? 0;
    const newest = await ctx.db
      .query("metricReadings")
      .withIndex("by_project_metric_at", (q) =>
        q.eq("project", args.project.trim()).eq("metric", args.metric.trim()).gte("at", since),
      )
      .order("desc")
      .take(limit);
    return newest.reverse();
  },
});
