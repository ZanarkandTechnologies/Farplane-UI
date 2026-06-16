import { query } from "../../_generated/server";
import { buildTelemetrySummary } from "../runtimeTelemetry/runtimeTelemetry";
import { telemetryDashboardArgsValidator } from "../runtimeTelemetry/validators";
import { buildSkillInvocationDashboard } from "../skillInvocations/contracts";
import { hookTelemetryRowsToActivityPingRows, hookTelemetryRowsToSkillInvocationRows, type HookTelemetryRow } from "./projections";
import { hookTelemetryWindowArgsValidator } from "./validators";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MAX_DAYS = 90;
const MAX_ROWS = 5000;

function normalizeDays(days: number | undefined): number {
  return Math.max(1, Math.min(MAX_DAYS, Math.floor(days ?? 30)));
}

function normalizeLimit(limit: number | undefined): number {
  return Math.max(1, Math.min(MAX_ROWS, Math.floor(limit ?? 500)));
}

function toHookTelemetryRow(row: HookTelemetryRow): HookTelemetryRow {
  return {
    _id: row._id,
    hookName: row.hookName,
    hookType: row.hookType,
    projectId: row.projectId,
    sessionId: row.sessionId,
    payload: row.payload,
    eventAt: row.eventAt,
    eventKey: row.eventKey,
  };
}

export const listHookTelemetryEvents = query({
  args: hookTelemetryWindowArgsValidator,
  handler: async (ctx, args) => {
    const cutoff = Date.now() - normalizeDays(args.rangeDays) * MS_PER_DAY;
    const limit = normalizeLimit(args.limit);
    let rows;
    if (args.projectId?.trim()) {
      const projectId = args.projectId.trim();
      rows = await ctx.db
        .query("hookTelemetryEvents")
        .withIndex("by_project_eventAt", (q) => q.eq("projectId", projectId).gte("eventAt", cutoff))
        .order("desc")
        .take(limit);
    } else if (args.sessionId?.trim()) {
      const sessionId = args.sessionId.trim();
      rows = await ctx.db
        .query("hookTelemetryEvents")
        .withIndex("by_session_eventAt", (q) => q.eq("sessionId", sessionId).gte("eventAt", cutoff))
        .order("desc")
        .take(limit);
    } else if (args.hookName?.trim()) {
      const hookName = args.hookName.trim();
      rows = await ctx.db
        .query("hookTelemetryEvents")
        .withIndex("by_hook_eventAt", (q) => q.eq("hookName", hookName).gte("eventAt", cutoff))
        .order("desc")
        .take(limit);
    } else {
      rows = await ctx.db
        .query("hookTelemetryEvents")
        .withIndex("by_eventAt", (q) => q.gte("eventAt", cutoff))
        .order("desc")
        .take(limit);
    }
    return rows
      .filter((row) => !args.hookType?.trim() || row.hookType === args.hookType.trim())
      .map(toHookTelemetryRow);
  },
});

export const getSkillInvocationDashboardFromHookTelemetry = query({
  args: {
    rangeDays: hookTelemetryWindowArgsValidator.rangeDays,
    limit: hookTelemetryWindowArgsValidator.limit,
  },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - normalizeDays(args.rangeDays) * MS_PER_DAY;
    const rows = await ctx.db
      .query("hookTelemetryEvents")
      .withIndex("by_hook_eventAt", (q) => q.eq("hookName", "skill-invocation-listener").gte("eventAt", cutoff))
      .order("desc")
      .take(MAX_ROWS);
    return buildSkillInvocationDashboard(hookTelemetryRowsToSkillInvocationRows(rows.map(toHookTelemetryRow)), {
      limit: args.limit,
    });
  },
});

export const getRuntimeTelemetryDashboardFromHookTelemetry = query({
  args: telemetryDashboardArgsValidator,
  handler: async (ctx, args) => {
    const days = normalizeDays(args.rangeDays);
    const cutoff = Date.now() - days * MS_PER_DAY;
    const rows = await ctx.db
      .query("hookTelemetryEvents")
      .withIndex("by_eventAt", (q) => q.gte("eventAt", cutoff))
      .order("desc")
      .take(MAX_ROWS);
    return buildTelemetrySummary(hookTelemetryRowsToActivityPingRows(rows.map(toHookTelemetryRow)), {
      days,
      now: Date.now(),
      timezone: args.timezone,
      maxTurnDurationMs: args.maxTurnDurationMs,
      turnPage: args.turnPage,
      turnPageSize: args.turnPageSize,
    });
  },
});
