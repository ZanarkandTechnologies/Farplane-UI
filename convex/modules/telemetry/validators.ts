import { type Infer, v } from "convex/values";

// One telemetry log for every observed event. `source` says which writer it came from:
// - `hook`: Codex/Claude hook lifecycle rows posted to `/telemetry/hooks` (was `hookTelemetryEvents`).
// - `runtime`: agent heartbeats, activity and self-reports posted to `/ingest` and `/status/report`
//   (was `agentActivity`'s `agentEvents`); `agentStatus` stays the reduced live row.
// `legacyId` is the source row's id in the old table, set only by the copy migration.

export const hookEventValidator = v.object({
  source: v.literal("hook"),
  hookName: v.string(),
  hookType: v.string(),
  projectId: v.optional(v.string()),
  sessionId: v.optional(v.string()),
  payload: v.optional(v.any()),
  eventAt: v.number(),
  eventKey: v.optional(v.string()),
  legacyId: v.optional(v.string()),
});

export const runtimeEventValidator = v.object({
  source: v.literal("runtime"),
  teamId: v.optional(v.string()),
  projectId: v.optional(v.string()),
  agentId: v.string(),
  eventType: v.string(),
  activityType: v.optional(v.string()),
  actorType: v.optional(v.string()),
  label: v.string(),
  detail: v.optional(v.string()),
  state: v.optional(v.string()),
  skillId: v.optional(v.string()),
  /** The writer's own source tag, such as `agent.self_report` (the old row's `source`). */
  origin: v.optional(v.string()),
  stepKey: v.optional(v.string()),
  /** The runtime session key (the old row's `sessionKey`). */
  sessionId: v.optional(v.string()),
  beatId: v.optional(v.string()),
  taskId: v.optional(v.string()),
  eventAt: v.number(),
  legacyId: v.optional(v.string()),
});

export const telemetryEventValidator = v.union(hookEventValidator, runtimeEventValidator);

export type HookEvent = Infer<typeof hookEventValidator>;
export type RuntimeEvent = Infer<typeof runtimeEventValidator>;
export type TelemetryEvent = Infer<typeof telemetryEventValidator>;

export const legacyTableValidator = v.union(v.literal("hook"), v.literal("runtime"));
export type LegacyTable = Infer<typeof legacyTableValidator>;

export const migrateLegacyEventsArgsValidator = {
  table: legacyTableValidator,
  cursor: v.optional(v.union(v.string(), v.null())),
  batchSize: v.optional(v.number()),
};

export const migrateLegacyEventsResultValidator = v.object({
  table: legacyTableValidator,
  scanned: v.number(),
  copied: v.number(),
  skipped: v.number(),
  cursor: v.string(),
  isDone: v.boolean(),
});
