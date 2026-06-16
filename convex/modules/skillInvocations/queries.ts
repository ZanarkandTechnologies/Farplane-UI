import { query } from "../../_generated/server";
import { hookTelemetryRowsToSkillInvocationRows } from "../hookTelemetry/projections";
import { buildSkillInvocationDashboard, type SkillInvocationRow } from "./contracts";
import { skillInvocationDashboardArgsValidator } from "./validators";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MAX_DAYS = 90;
const MAX_ROWS = 5000;

function normalizeDays(days: number | undefined): number {
  return Math.max(1, Math.min(MAX_DAYS, Math.floor(days ?? 30)));
}

function toSkillInvocationRow(row: SkillInvocationRow): SkillInvocationRow {
  return {
    _id: row._id,
    skillId: row.skillId,
    skillPath: row.skillPath,
    sourceTool: row.sourceTool,
    sourceEvent: row.sourceEvent,
    label: row.label,
    sessionId: row.sessionId,
    turnId: row.turnId,
    projectPath: row.projectPath,
    occurredAt: row.occurredAt,
    stepKey: row.stepKey,
    source: row.source,
    receivedAt: row.receivedAt,
  };
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

export const getSkillInvocationDashboard = query({
  args: skillInvocationDashboardArgsValidator,
  handler: async (ctx, args) => {
    const days = normalizeDays(args.rangeDays);
    const cutoff = Date.now() - days * MS_PER_DAY;
    const hookRows = await ctx.db
      .query("hookTelemetryEvents")
      .withIndex("by_hook_eventAt", (q) =>
        q.eq("hookName", "skill-invocation-listener").gte("eventAt", cutoff),
      )
      .order("desc")
      .take(MAX_ROWS);

    return buildSkillInvocationDashboard(hookTelemetryRowsToSkillInvocationRows(hookRows.map(toHookTelemetryRow)), {
      limit: args.limit,
    });
  },
});
