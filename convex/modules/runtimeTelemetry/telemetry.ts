import { query } from "../../_generated/server";
import { hookTelemetryRowsToActivityPingRows } from "../hookTelemetry/projections";
import { type ActivityPingRow, buildTelemetrySummary } from "./runtimeTelemetry";
import {
  teamTelemetryArgsValidator,
  telemetryDashboardArgsValidator,
} from "./validators";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MAX_DAYS = 90;
const MAX_ROWS = 5000;

function normalizeDays(days: number | undefined): number {
  return Math.max(1, Math.min(MAX_DAYS, Math.floor(days ?? 30)));
}

function toHookTelemetryRow(row: {
  _id: string;
  hookName: string;
  hookType: string;
  projectId?: string;
  sessionId?: string;
  payload?: unknown;
  eventAt: number;
  eventKey?: string;
}) {
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

export const getTelemetryDashboard = query({
  args: telemetryDashboardArgsValidator,
  handler: async (ctx, args) => {
    const days = normalizeDays(args.rangeDays);
    const now = Date.now();
    const cutoff = now - days * MS_PER_DAY;
    const rows = await ctx.db
      .query("hookTelemetryEvents")
      .withIndex("by_eventAt", (q) => q.gte("eventAt", cutoff))
      .order("desc")
      .take(MAX_ROWS);
    return buildTelemetrySummary(hookTelemetryRowsToActivityPingRows(rows.map(toHookTelemetryRow)), {
      days,
      maxTurnDurationMs: args.maxTurnDurationMs,
      now,
      timezone: args.timezone,
      turnPage: args.turnPage,
      turnPageSize: args.turnPageSize,
    });
  },
});

export const getTeamTelemetry = query({
  args: teamTelemetryArgsValidator,
  handler: async (ctx, args) => {
    const days = normalizeDays(args.rangeDays);
    const now = Date.now();
    const cutoff = now - days * MS_PER_DAY;
    const teamId = args.teamId?.trim().toLowerCase();
    const projectId = args.projectId?.trim() || (teamId?.startsWith("team-") ? teamId.slice("team-".length) : teamId);
    const projectRows = projectId
      ? await ctx.db
          .query("hookTelemetryEvents")
          .withIndex("by_project_eventAt", (q) =>
            q.eq("projectId", projectId).gte("eventAt", cutoff),
          )
          .order("desc")
          .take(MAX_ROWS)
      : [];
    const rows = [...projectRows].sort((left, right) => right.eventAt - left.eventAt);

    return buildTelemetrySummary(hookTelemetryRowsToActivityPingRows(rows.map(toHookTelemetryRow)), {
      days,
      maxTurnDurationMs: args.maxTurnDurationMs,
      now,
      timezone: args.timezone,
      turnPage: args.turnPage,
      turnPageSize: args.turnPageSize,
    });
  },
});
