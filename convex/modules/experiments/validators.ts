import { type Infer, v } from "convex/values";

// A/B tests as the office's file store kept them (Farplane-UI-v2 `ab/<project>/<id>.json` plus
// `<id>.sends.jsonl`): one variable of one loop step, two or three options, each run picks one at random and
// records a send; a send's outcome says whether it succeeded by the test's metric. Times are ms here; the
// list query returns ISO strings like the file store's projection did.

export const loopStepValidator = v.union(
  v.literal("offer"),
  v.literal("leads"),
  v.literal("sales"),
  v.literal("delivery"),
);
export type LoopStep = Infer<typeof loopStepValidator>;

export const abStatusValidator = v.union(
  v.literal("proposed"),
  v.literal("running"),
  v.literal("done"),
  v.literal("stopped"),
);
export type AbStatus = Infer<typeof abStatusValidator>;

/** Where an option's result is read when it isn't recorded send by send (Metrics Refresh writes it). */
export const metricSourceKindValidator = v.union(
  v.literal("whop_plan"),
  v.literal("utm"),
  v.literal("dm_thread"),
  v.literal("other"),
);
export const metricSourceValidator = v.object({
  kind: metricSourceKindValidator,
  ref: v.string(),
});
export type MetricSource = Infer<typeof metricSourceValidator>;

export const abOptionValidator = v.object({
  id: v.string(),
  label: v.string(),
  /** A number someone measured for it by hand (a baseline), when there is one. */
  value: v.optional(v.union(v.number(), v.null())),
  metricSource: v.optional(metricSourceValidator),
});
export type AbOption = Infer<typeof abOptionValidator>;

export const abWhyValidator = v.object({
  hypothesis: v.string(),
  expected: v.union(v.string(), v.null()),
  falsifier: v.union(v.string(), v.null()),
});

export const abMetricValidator = v.object({
  label: v.string(),
  windowDays: v.number(),
  /** The metric it tries to move, as `<owner-or-project>:<metric-id>`. */
  ref: v.optional(v.union(v.string(), v.null())),
  unit: v.optional(v.union(v.string(), v.null())),
  direction: v.optional(v.union(v.literal("maximize"), v.literal("minimize"))),
  baseline: v.optional(v.union(v.number(), v.null())),
});

export const abTestFields = {
  project: v.string(),
  testId: v.string(),
  step: v.union(loopStepValidator, v.null()),
  title: v.optional(v.string()),
  status: abStatusValidator,
  variable: v.string(),
  why: v.optional(abWhyValidator),
  metric: abMetricValidator,
  /** When it started (ms); null while proposed. */
  startedAt: v.union(v.number(), v.null()),
  options: v.array(abOptionValidator),
  /** The option made the default once a winner was called. */
  defaultOption: v.optional(v.string()),
  decidedAt: v.optional(v.number()),
  owner: v.optional(v.string()),
  forName: v.optional(v.string()),
  source: v.optional(v.string()),
  updatedAt: v.number(),
};
export const abTestValidator = v.object(abTestFields);
export type AbTestRow = Infer<typeof abTestValidator>;

export const abSendFields = {
  project: v.string(),
  testId: v.string(),
  /** 12 hex characters, as the file store's sends had. */
  sendId: v.string(),
  option: v.string(),
  at: v.number(),
  success: v.optional(v.boolean()),
  outcomeAt: v.optional(v.number()),
};
export const abSendValidator = v.object(abSendFields);
export type AbSendRow = Infer<typeof abSendValidator>;

/** An option's cumulative totals from its metric source at one time; the latest one counts. */
export const abSourceTotalFields = {
  project: v.string(),
  testId: v.string(),
  option: v.string(),
  kind: metricSourceKindValidator,
  ref: v.string(),
  successes: v.number(),
  attempts: v.number(),
  at: v.number(),
  note: v.optional(v.string()),
};
export const abSourceTotalValidator = v.object(abSourceTotalFields);
export type AbSourceTotalRow = Infer<typeof abSourceTotalValidator>;

const testRef = { project: v.string(), testId: v.string() };

export const listTestsArgsValidator = { project: v.optional(v.string()) };
export const getTestArgsValidator = testRef;

export const proposeTestArgsValidator = {
  ...testRef,
  title: v.string(),
  step: v.optional(v.union(loopStepValidator, v.null())),
  variable: v.optional(v.string()),
  why: abWhyValidator,
  metric: abMetricValidator,
  options: v.array(abOptionValidator),
  owner: v.optional(v.string()),
  forName: v.optional(v.string()),
  source: v.optional(v.string()),
};

export const startTestArgsValidator = {
  ...testRef,
  step: loopStepValidator,
  variable: v.string(),
  /** The metric's label, locked now with its window. */
  metric: v.string(),
  windowDays: v.optional(v.number()),
  /** Two or three options; omit to start a proposed test with the options it was proposed with. */
  options: v.optional(v.array(abOptionValidator)),
};

export const pickOptionArgsValidator = testRef;
export const pickOptionResultValidator = v.object({
  sendId: v.string(),
  at: v.number(),
  option: v.string(),
  label: v.string(),
});

export const recordOutcomeArgsValidator = { ...testRef, sendId: v.string(), success: v.boolean() };
export const makeDefaultArgsValidator = { ...testRef, option: v.string() };

export const recordSourceTotalsArgsValidator = {
  ...testRef,
  option: v.string(),
  successes: v.number(),
  attempts: v.number(),
  at: v.number(),
  note: v.optional(v.string()),
};

export const importSendValidator = v.object({
  id: v.string(),
  at: v.string(),
  option: v.string(),
  success: v.optional(v.union(v.boolean(), v.null())),
});
export type ImportSend = Infer<typeof importSendValidator>;

export const importTestArgsValidator = {
  project: v.string(),
  /** The test file's JSON as the file store wrote it (`ab/<project>/<id>.json`). */
  test: v.any(),
  /** Its sends, one per send id with the outcome merged in (later lines of the .jsonl win). */
  sends: v.optional(v.array(importSendValidator)),
};
