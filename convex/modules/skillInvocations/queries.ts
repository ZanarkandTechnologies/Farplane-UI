import { query } from "../../_generated/server";
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

export const getSkillInvocationDashboard = query({
  args: skillInvocationDashboardArgsValidator,
  handler: async (ctx, args) => {
    const days = normalizeDays(args.rangeDays);
    const cutoff = Date.now() - days * MS_PER_DAY;
    const rows = await ctx.db
      .query("skillInvocationEvents")
      .withIndex("by_occurredAt", (q) => q.gte("occurredAt", cutoff))
      .order("desc")
      .take(MAX_ROWS);

    return buildSkillInvocationDashboard(rows.map(toSkillInvocationRow), {
      limit: args.limit,
    });
  },
});
