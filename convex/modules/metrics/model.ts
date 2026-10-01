// Pure normalization for metric readings: trimmed ids, capped text, finite numbers. Throws on input no
// screen could show.
import { ConvexError } from "convex/values";
import type { MetricReadingInput } from "./validators";

export const MAX_BATCH = 200;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/;

function clean(value: string | undefined, limit: number): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, limit) : undefined;
}

export function normalizeReading(input: MetricReadingInput): MetricReadingInput {
  const project = input.project.trim();
  const metric = input.metric.trim();
  if (!ID.test(project)) throw new ConvexError(`invalid project: ${JSON.stringify(input.project)}`);
  if (!ID.test(metric)) throw new ConvexError(`invalid metric: ${JSON.stringify(input.metric)}`);
  if (input.value !== null && !Number.isFinite(input.value)) throw new ConvexError("value must be finite or null");
  if (!Number.isFinite(input.at) || input.at <= 0) throw new ConvexError("at must be a time in ms");
  const source = clean(input.source, 60);
  if (!source) throw new ConvexError("source is required");
  const display = clean(input.display, 120) ?? (input.value === null ? "" : String(input.value));
  return {
    project,
    metric,
    value: input.value,
    display,
    unit: clean(input.unit, 40),
    at: Math.floor(input.at),
    source,
    note: clean(input.note, 500),
  };
}
