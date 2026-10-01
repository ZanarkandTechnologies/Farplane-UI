// A/B tests: list and read them (internal queries), and propose, start, pick, record outcomes, record a metric
// source's totals, make a winner the default, or import a file-store test (internal mutations, reached over
// the token-checked `/experiments/ab` route or `npx convex run`).
import { ConvexError, v } from "convex/values";
import type { Doc } from "../../_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "../../_generated/server";
import {
  assertTestRef,
  fileSendToRow,
  fileTestToRow,
  isRunning,
  newSendId,
  normalizeOptions,
  pickIndex,
  projectTest,
  SEND_ID,
  startOptions,
} from "./model";
import {
  getTestArgsValidator,
  importTestArgsValidator,
  listTestsArgsValidator,
  makeDefaultArgsValidator,
  pickOptionArgsValidator,
  pickOptionResultValidator,
  proposeTestArgsValidator,
  recordOutcomeArgsValidator,
  recordSourceTotalsArgsValidator,
  startTestArgsValidator,
} from "./validators";

const MAX_TESTS = 500;
const MAX_SENDS = 10_000;

async function findTest(ctx: QueryCtx, project: string, testId: string) {
  return await ctx.db
    .query("abTests")
    .withIndex("by_project_testId", (q) => q.eq("project", project).eq("testId", testId))
    .first();
}

async function requireTest(ctx: QueryCtx, project: string, testId: string) {
  assertTestRef(project, testId);
  const test = await findTest(ctx, project, testId);
  if (!test) throw new ConvexError("no such test");
  return test;
}

async function projectionFor(ctx: QueryCtx, test: Doc<"abTests">) {
  const sends = await ctx.db
    .query("abSends")
    .withIndex("by_project_test_at", (q) => q.eq("project", test.project).eq("testId", test.testId))
    .take(MAX_SENDS);
  const latestTotals = [];
  for (const option of test.options) {
    const latest = await ctx.db
      .query("abSourceTotals")
      .withIndex("by_project_test_option_at", (q) =>
        q.eq("project", test.project).eq("testId", test.testId).eq("option", option.id),
      )
      .order("desc")
      .first();
    if (latest) latestTotals.push(latest);
  }
  return projectTest(test, sends, latestTotals);
}

/** A floor's tests (or every floor's), each option with its sends and successes; the office makes the call. */
export const listTests = internalQuery({
  args: listTestsArgsValidator,
  handler: async (ctx, args) => {
    const project = args.project?.trim();
    const tests = project
      ? await ctx.db
          .query("abTests")
          .withIndex("by_project_testId", (q) => q.eq("project", project))
          .take(MAX_TESTS)
      : await ctx.db.query("abTests").withIndex("by_project_testId").take(MAX_TESTS);
    const projected = [];
    for (const test of tests) projected.push(await projectionFor(ctx, test));
    return { project: project ?? null, generatedAt: new Date().toISOString(), tests: projected };
  },
});

export const getTest = internalQuery({
  args: getTestArgsValidator,
  handler: async (ctx, args) => {
    const test = await findTest(ctx, args.project.trim(), args.testId.trim());
    return test ? await projectionFor(ctx, test) : null;
  },
});

/** Writes a test down as a proposal: why it's worth running, no sends, until someone starts it. */
export const proposeTest = internalMutation({
  args: proposeTestArgsValidator,
  returns: v.object({ testId: v.string() }),
  handler: async (ctx, args) => {
    assertTestRef(args.project, args.testId);
    if (!args.title.trim()) throw new ConvexError("an A/B test needs a title");
    if (!args.metric.label.trim() || !args.metric.ref?.trim()) {
      throw new ConvexError("an A/B test needs metric.ref (`<owner-or-project>:<metric-id>`) and metric.label");
    }
    if (!args.why.hypothesis.trim()) throw new ConvexError("an A/B test needs why.hypothesis");
    if (await findTest(ctx, args.project, args.testId)) {
      throw new ConvexError(`an A/B test called ${args.testId} already exists`);
    }
    await ctx.db.insert("abTests", {
      project: args.project,
      testId: args.testId,
      step: args.step ?? null,
      title: args.title.trim(),
      status: "proposed",
      variable: args.variable?.trim() || args.title.trim(),
      why: args.why,
      metric: args.metric,
      startedAt: null,
      options: normalizeOptions(args.options),
      owner: args.owner,
      forName: args.forName,
      source: args.source ?? "whiteboard",
      updatedAt: Date.now(),
    });
    return { testId: args.testId };
  },
});

/** Starts a test, locking its metric and window now; a proposed test with the same id starts in place. */
export const startTest = internalMutation({
  args: startTestArgsValidator,
  returns: v.object({ testId: v.string() }),
  handler: async (ctx, args) => {
    assertTestRef(args.project, args.testId);
    const proposed = await findTest(ctx, args.project, args.testId);
    if (proposed && (proposed.startedAt !== null || proposed.status !== "proposed")) {
      throw new ConvexError("a test with that id is already running");
    }
    if (!proposed && !args.options) throw new ConvexError("a test has two or three options");
    const now = Date.now();
    const fields = {
      step: args.step,
      variable: args.variable.trim() || args.testId,
      status: "running" as const,
      metric: { ...proposed?.metric, label: args.metric.trim() || "success", windowDays: args.windowDays ?? 14 },
      options: startOptions(args.options, proposed?.options ?? []),
      startedAt: now,
      updatedAt: now,
    };
    if (proposed) await ctx.db.patch(proposed._id, fields);
    else await ctx.db.insert("abTests", { project: args.project, testId: args.testId, ...fields });
    return { testId: args.testId };
  },
});

/** One run of the step: picks an option (an even split) and records the send. */
export const pickOption = internalMutation({
  args: pickOptionArgsValidator,
  returns: pickOptionResultValidator,
  handler: async (ctx, args) => {
    const test = await requireTest(ctx, args.project, args.testId);
    if (!isRunning(test)) throw new ConvexError(`${args.testId} isn't running: start it first`);
    const option = test.options[pickIndex(test.options.length)];
    let sendId = newSendId();
    while (await findSend(ctx, args.project, args.testId, sendId)) sendId = newSendId();
    const at = Date.now();
    await ctx.db.insert("abSends", { project: args.project, testId: args.testId, sendId, option: option.id, at });
    return { sendId, at, option: option.id, label: option.label };
  },
});

async function findSend(ctx: QueryCtx, project: string, testId: string, sendId: string) {
  return await ctx.db
    .query("abSends")
    .withIndex("by_project_test_send", (q) => q.eq("project", project).eq("testId", testId).eq("sendId", sendId))
    .first();
}

/** Whether a send succeeded, by the test's locked metric. */
export const recordOutcome = internalMutation({
  args: recordOutcomeArgsValidator,
  returns: v.null(),
  handler: async (ctx, args) => {
    assertTestRef(args.project, args.testId);
    const send = SEND_ID.test(args.sendId) ? await findSend(ctx, args.project, args.testId, args.sendId) : null;
    if (!send) throw new ConvexError("no such send");
    await ctx.db.patch(send._id, { success: args.success, outcomeAt: Date.now() });
    return null;
  },
});

/**
 * An option's cumulative successes and attempts from its metric source (a Whop plan's paid sales, say) as of
 * `at`. The newest reading per option counts; one at the same `at` replaces the earlier one.
 */
export const recordSourceTotals = internalMutation({
  args: recordSourceTotalsArgsValidator,
  returns: v.null(),
  handler: async (ctx, args) => {
    const test = await requireTest(ctx, args.project, args.testId);
    const option = test.options.find((o) => o.id === args.option);
    if (!option) throw new ConvexError("no such option");
    if (!option.metricSource) throw new ConvexError(`option ${args.option} names no metricSource`);
    for (const n of [args.successes, args.attempts]) {
      if (!Number.isInteger(n) || n < 0) throw new ConvexError("successes and attempts are whole numbers");
    }
    if (args.successes > args.attempts) throw new ConvexError("successes can't exceed attempts");
    const row = {
      project: args.project,
      testId: args.testId,
      option: args.option,
      kind: option.metricSource.kind,
      ref: option.metricSource.ref,
      successes: args.successes,
      attempts: args.attempts,
      at: Math.floor(args.at),
      note: args.note?.trim() || undefined,
    };
    const same = await ctx.db
      .query("abSourceTotals")
      .withIndex("by_project_test_option_at", (q) =>
        q.eq("project", row.project).eq("testId", row.testId).eq("option", row.option).eq("at", row.at),
      )
      .first();
    if (same) await ctx.db.replace(same._id, row);
    else await ctx.db.insert("abSourceTotals", row);
    return null;
  },
});

/** Makes the winning option the default and closes the test (status `done`). */
export const makeDefault = internalMutation({
  args: makeDefaultArgsValidator,
  returns: v.null(),
  handler: async (ctx, args) => {
    const test = await requireTest(ctx, args.project, args.testId);
    if (!test.options.some((o) => o.id === args.option)) throw new ConvexError("no such option");
    if (test.startedAt === null) throw new ConvexError(`${args.testId} never started`);
    const now = Date.now();
    await ctx.db.patch(test._id, { defaultOption: args.option, status: "done", decidedAt: now, updatedAt: now });
    return null;
  },
});

async function upsertImportedTest(
  ctx: MutationCtx,
  row: ReturnType<typeof fileTestToRow>,
): Promise<"inserted" | "updated"> {
  const existing = await findTest(ctx, row.project, row.testId);
  if (existing) await ctx.db.replace(existing._id, row);
  else await ctx.db.insert("abTests", row);
  return existing ? "updated" : "inserted";
}

/** Copies one file-store test and its sends in; re-running it updates the test and skips sends it has. */
export const importTest = internalMutation({
  args: importTestArgsValidator,
  returns: v.object({
    testId: v.string(),
    test: v.union(v.literal("inserted"), v.literal("updated")),
    sendsInserted: v.number(),
    sendsUpdated: v.number(),
    sendsSkipped: v.number(),
  }),
  handler: async (ctx, args) => {
    const row = fileTestToRow(args.project.trim(), args.test, Date.now());
    const test = await upsertImportedTest(ctx, row);
    const optionIds = row.options.map((o) => o.id);
    let sendsInserted = 0;
    let sendsUpdated = 0;
    let sendsSkipped = 0;
    for (const raw of args.sends ?? []) {
      const send = fileSendToRow(row.project, row.testId, optionIds, raw);
      if (!send) {
        sendsSkipped += 1;
        continue;
      }
      const existing = await findSend(ctx, row.project, row.testId, send.sendId);
      if (!existing) {
        await ctx.db.insert("abSends", send);
        sendsInserted += 1;
      } else if (existing.success !== send.success && send.success !== undefined) {
        await ctx.db.patch(existing._id, { success: send.success });
        sendsUpdated += 1;
      } else {
        sendsSkipped += 1;
      }
    }
    return { testId: row.testId, test, sendsInserted, sendsUpdated, sendsSkipped };
  },
});
