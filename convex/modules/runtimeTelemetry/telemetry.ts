import { v } from "convex/values";
import { internalMutation, query } from "../../_generated/server";
import { buildTelemetrySummary, type ActivityPingRow } from "./runtimeTelemetry";
import { ingestActivityPingArgsValidator, teamTelemetryArgsValidator, telemetryDashboardArgsValidator } from "./validators";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MAX_DAYS = 90;
const MAX_ROWS = 5000;

function cleanText(value: string | undefined, limit: number): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, limit);
}

function normalizeDays(days: number | undefined): number {
  return Math.max(1, Math.min(MAX_DAYS, Math.floor(days ?? 30)));
}

function toActivityPingRow(row: ActivityPingRow): ActivityPingRow {
  return {
    _id: row._id,
    eventType: row.eventType,
    source: row.source,
    activeAgentCount: row.activeAgentCount,
    prompt: row.prompt,
    agentName: row.agentName,
    workflowName: row.workflowName,
    machineName: row.machineName,
    projectName: row.projectName,
    projectDirectory: row.projectDirectory,
    projectId: row.projectId,
    teamId: row.teamId,
    sessionId: row.sessionId,
    turnId: row.turnId,
    receivedAt: row.receivedAt,
  };
}

export const ingestActivityPing = internalMutation({
  args: ingestActivityPingArgsValidator,
  returns: v.id("runtimeTelemetryActivityPings"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("runtimeTelemetryActivityPings", {
      eventType: args.eventType,
      source: cleanText(args.source, 120) ?? "unknown",
      activeAgentCount: Math.max(1, Math.floor(args.activeAgentCount || 1)),
      prompt: cleanText(args.prompt, 100),
      agentName: cleanText(args.agentName, 80),
      workflowName: cleanText(args.workflowName, 120),
      machineName: cleanText(args.machineName, 120),
      projectName: cleanText(args.projectName, 120),
      projectDirectory: cleanText(args.projectDirectory, 240),
      projectId: cleanText(args.projectId, 120),
      teamId: cleanText(args.teamId, 120)?.toLowerCase(),
      sessionId: cleanText(args.sessionId, 120),
      turnId: cleanText(args.turnId, 120),
      receivedAt: args.receivedAt ?? Date.now(),
    });
  },
});

export const getTelemetryDashboard = query({
  args: telemetryDashboardArgsValidator,
  handler: async (ctx, args) => {
    const days = normalizeDays(args.rangeDays);
    const now = Date.now();
    const cutoff = now - days * MS_PER_DAY;
    const rows = await ctx.db
      .query("runtimeTelemetryActivityPings")
      .withIndex("by_receivedAt", (q) => q.gte("receivedAt", cutoff))
      .order("desc")
      .take(MAX_ROWS);
    return buildTelemetrySummary(rows.map(toActivityPingRow), {
      days,
      now,
      timezone: args.timezone,
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
    const projectId = args.projectId?.trim();
    const teamRows = teamId
      ? await ctx.db
          .query("runtimeTelemetryActivityPings")
          .withIndex("by_teamId_and_receivedAt", (q) => q.eq("teamId", teamId).gte("receivedAt", cutoff))
          .order("desc")
          .take(MAX_ROWS)
      : [];
    const projectRows = projectId
      ? await ctx.db
          .query("runtimeTelemetryActivityPings")
          .withIndex("by_projectId_and_receivedAt", (q) => q.eq("projectId", projectId).gte("receivedAt", cutoff))
          .order("desc")
          .take(MAX_ROWS)
      : [];
    const rowsById = new Map<string, (typeof teamRows)[number]>();
    for (const row of [...teamRows, ...projectRows]) {
      rowsById.set(row._id, row);
    }
    const rows = Array.from(rowsById.values()).sort((left, right) => right.receivedAt - left.receivedAt);

    return buildTelemetrySummary(rows.map(toActivityPingRow), {
      days,
      now,
      timezone: args.timezone,
    });
  },
});
