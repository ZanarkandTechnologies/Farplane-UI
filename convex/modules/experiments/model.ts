// Pure A/B test rules shared by the mutations, the list query and the file import: ids, options, counts and
// the projection the office reads. The call (winner / same / inconclusive) stays with the office's
// shared/abtest.ts, which computes it from the counts returned here.
import { ConvexError } from "convex/values";
import type {
  AbOption,
  AbSendRow,
  AbSourceTotalRow,
  AbStatus,
  AbTestRow,
  ImportSend,
  LoopStep,
} from "./validators";

export const TEST_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
/** A floor's id: no slashes, no leading dot (as the file store's folder names). */
export const PROJECT_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
export const SEND_ID = /^[a-f0-9]{12}$/;
/** How many of a test's latest sends its projection lists. */
export const RUNS = 50;
const LOOP_STEPS: readonly LoopStep[] = ["offer", "leads", "sales", "delivery"];
const STATUSES: readonly AbStatus[] = ["proposed", "running", "done", "stopped"];

export function assertTestRef(project: string, testId: string): void {
  if (!PROJECT_ID.test(project)) throw new ConvexError("project is a floor id such as `company`");
  if (!TEST_ID.test(testId)) throw new ConvexError("the test id is a short kebab-case name");
}

/** Two or three options with kebab-case ids, labels defaulting to the id. */
export function normalizeOptions(options: readonly AbOption[]): AbOption[] {
  const kept = options
    .filter((option) => TEST_ID.test(option.id))
    .map((option) => ({ ...option, label: option.label.trim() || option.id }));
  if (kept.length < 2 || kept.length > 3) throw new ConvexError("a test has two or three options");
  if (new Set(kept.map((option) => option.id)).size !== kept.length) {
    throw new ConvexError("option ids must differ");
  }
  return kept;
}

/** Options to start with: the given ones, keeping a proposal's baseline and metric source by id. */
export function startOptions(given: readonly AbOption[] | undefined, proposed: readonly AbOption[]): AbOption[] {
  if (!given) return normalizeOptions(proposed);
  const byId = new Map(proposed.map((option) => [option.id, option]));
  return normalizeOptions(
    given.map((option) => ({
      ...option,
      value: option.value ?? byId.get(option.id)?.value,
      metricSource: option.metricSource ?? byId.get(option.id)?.metricSource,
    })),
  );
}

export function isRunning(test: Pick<AbTestRow, "status" | "startedAt">): boolean {
  return test.status === "running" && test.startedAt !== null;
}

/** A 12-hex send id from a [0, 1) source. */
export function newSendId(random: () => number = Math.random): string {
  let out = "";
  for (let i = 0; i < 12; i++) out += Math.floor(random() * 16).toString(16);
  return out;
}

/** An even split: the option for one run. */
export function pickIndex(count: number, random: () => number = Math.random): number {
  return Math.floor(random() * count) % count;
}

export type OptionCount = { id: string; sends: number; successes: number };

/**
 * Each option's sends and successes: its recorded sends plus its metric source's latest totals (cumulative,
 * so only the newest reading per option counts).
 */
export function countOptions(
  options: readonly Pick<AbOption, "id">[],
  sends: readonly Pick<AbSendRow, "option" | "success">[],
  latestTotals: readonly Pick<AbSourceTotalRow, "option" | "successes" | "attempts">[],
): OptionCount[] {
  return options.map((option) => {
    const own = sends.filter((send) => send.option === option.id);
    const total = latestTotals.find((row) => row.option === option.id);
    return {
      id: option.id,
      sends: own.length + (total?.attempts ?? 0),
      successes: own.filter((send) => send.success === true).length + (total?.successes ?? 0),
    };
  });
}

const iso = (ms: number | null | undefined) => (typeof ms === "number" ? new Date(ms).toISOString() : null);

/** The office's AbTest shape (Farplane-UI-v2 shared/panels/ab-types.ts) without `verdict` and `chance`. */
export function projectTest(
  test: AbTestRow,
  sends: readonly AbSendRow[],
  latestTotals: readonly AbSourceTotalRow[],
) {
  const counts = countOptions(test.options, sends, latestTotals);
  return {
    id: test.testId,
    project: test.project,
    step: test.step,
    title: test.title ?? null,
    status: test.status,
    variable: test.variable,
    why: test.why ?? null,
    metric: {
      label: test.metric.label,
      windowDays: test.metric.windowDays,
      ref: test.metric.ref ?? null,
      unit: test.metric.unit ?? null,
      direction: test.metric.direction ?? "maximize",
      baseline: test.metric.baseline ?? null,
    },
    startedAt: iso(test.startedAt),
    options: test.options.map((option, index) => ({
      id: option.id,
      label: option.label,
      value: option.value ?? null,
      metricSource: option.metricSource ?? null,
      sends: counts[index].sends,
      successes: counts[index].successes,
    })),
    runs: [...sends]
      .sort((a, b) => b.at - a.at)
      .slice(0, RUNS)
      .map((send) => ({ sendId: send.sendId, at: iso(send.at), option: send.option, success: send.success ?? null })),
    sourceTotals: latestTotals.map((row) => ({
      option: row.option,
      kind: row.kind,
      ref: row.ref,
      successes: row.successes,
      attempts: row.attempts,
      at: iso(row.at),
    })),
    defaultOption: test.defaultOption ?? null,
    decidedAt: iso(test.decidedAt),
    owner: test.owner ?? null,
    forName: test.forName ?? null,
    source: test.source ?? null,
  };
}

type UnknownRecord = Record<string, unknown>;
const record = (value: unknown): UnknownRecord =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as UnknownRecord) : {};
const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
const num = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;
const optionalText = (value: unknown): string | undefined => text(value) || undefined;

function fileOption(value: unknown): AbOption {
  const option = record(value);
  const source = record(option.metricSource);
  const kind = text(source.kind);
  return {
    id: text(option.id),
    label: text(option.label) || text(option.id),
    value: num(option.value),
    metricSource:
      text(source.ref) && ["whop_plan", "utm", "dm_thread", "other"].includes(kind)
        ? { kind: kind as "whop_plan" | "utm" | "dm_thread" | "other", ref: text(source.ref) }
        : undefined,
  };
}

/** A test file's JSON as an `abTests` row, read as leniently as the file store read it. */
export function fileTestToRow(project: string, raw: unknown, now: number): AbTestRow {
  const t = record(raw);
  const testId = text(t.id);
  assertTestRef(project, testId);
  const options = normalizeOptions(list(t.options).map(fileOption).slice(0, 3));
  const startedAtMs = Date.parse(text(t.startedAt));
  const startedAt = Number.isFinite(startedAtMs) ? startedAtMs : null;
  const status = STATUSES.find((s) => s === t.status) ?? (startedAt !== null ? "running" : "proposed");
  const metric = record(t.metric);
  const why = record(t.why);
  const decidedAtMs = Date.parse(text(t.decidedAt));
  return {
    project,
    testId,
    step: LOOP_STEPS.find((s) => s === t.step) ?? null,
    title: optionalText(t.title),
    status,
    variable: text(t.variable) || text(t.title) || testId,
    why: text(why.hypothesis)
      ? { hypothesis: text(why.hypothesis), expected: text(why.expected) || null, falsifier: text(why.falsifier) || null }
      : undefined,
    metric: {
      label: text(metric.label) || text(metric.ref) || "success",
      windowDays: num(metric.windowDays) ?? 14,
      ref: text(metric.ref) || null,
      unit: text(metric.unit) || null,
      direction: metric.direction === "minimize" ? "minimize" : "maximize",
      baseline: num(metric.baseline),
    },
    startedAt,
    options,
    defaultOption: options.some((option) => option.id === text(t.defaultOption)) ? text(t.defaultOption) : undefined,
    decidedAt: Number.isFinite(decidedAtMs) ? decidedAtMs : undefined,
    owner: optionalText(t.owner),
    forName: optionalText(t.forName),
    source: optionalText(t.source),
    updatedAt: now,
  };
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** A file send as an `abSends` row, or null when it can't be one (bad id, time or option). */
export function fileSendToRow(
  project: string,
  testId: string,
  optionIds: readonly string[],
  send: ImportSend,
): AbSendRow | null {
  const at = Date.parse(send.at);
  if (!SEND_ID.test(send.id) || !Number.isFinite(at) || !optionIds.includes(send.option)) return null;
  return {
    project,
    testId,
    sendId: send.id,
    option: send.option,
    at,
    success: typeof send.success === "boolean" ? send.success : undefined,
  };
}
