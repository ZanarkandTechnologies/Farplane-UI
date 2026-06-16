import { v } from "convex/values";

export const activityEventTypeValidator = v.union(
  v.literal("heartbeat"),
  v.literal("turn_start"),
  v.literal("turn_end"),
);

export const activeAgentCountValidator = v.number();
export const receivedAtValidator = v.number();
export const optionalTelemetryTextValidator = v.optional(v.string());

export const telemetryDashboardArgsValidator = {
  timezone: v.optional(v.string()),
  rangeDays: v.optional(v.number()),
  maxTurnDurationMs: v.optional(v.union(v.number(), v.null())),
  turnPage: v.optional(v.number()),
  turnPageSize: v.optional(v.number()),
};

export const teamTelemetryArgsValidator = {
  teamId: v.optional(v.string()),
  projectId: v.optional(v.string()),
  timezone: v.optional(v.string()),
  rangeDays: v.optional(v.number()),
  maxTurnDurationMs: v.optional(v.union(v.number(), v.null())),
  turnPage: v.optional(v.number()),
  turnPageSize: v.optional(v.number()),
};
