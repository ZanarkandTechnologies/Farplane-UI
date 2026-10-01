import { type Infer, v } from "convex/values";

// One reading of one metric for one project at one time. A metric's current value is its latest reading;
// its history is every reading. Cash is metric `cash` with source `bank`; there is no separate finance table.

export const metricReadingFields = {
  /** The project slug (`company` for the company's own numbers). */
  project: v.string(),
  /** The metric id, such as `cash`, `mrr` or `followers`. */
  metric: v.string(),
  /** The number, or null when the source only has a display string (or the value is unknown). */
  value: v.union(v.number(), v.null()),
  /** How a screen shows it, such as `$12.4k` or `1,204`. */
  display: v.string(),
  unit: v.optional(v.string()),
  /** When the reading is true for (ms since epoch). */
  at: v.number(),
  /** Where it came from: `whop`, `bank`, `instagram`, `snapshot`, ... */
  source: v.string(),
  note: v.optional(v.string()),
};

export const metricReadingValidator = v.object(metricReadingFields);
export type MetricReadingInput = Infer<typeof metricReadingValidator>;

export const recordReadingsArgsValidator = {
  readings: v.array(metricReadingValidator),
};

export const recordResultValidator = v.object({
  inserted: v.number(),
  updated: v.number(),
});

export const latestArgsValidator = {
  project: v.optional(v.string()),
};

export const historyArgsValidator = {
  project: v.string(),
  metric: v.string(),
  /** Oldest `at` to include. */
  since: v.optional(v.number()),
  limit: v.optional(v.number()),
};

export const storedReadingValidator = v.object({
  _id: v.id("metricReadings"),
  _creationTime: v.number(),
  ...metricReadingFields,
});
