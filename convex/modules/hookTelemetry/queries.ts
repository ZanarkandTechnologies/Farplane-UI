import { query, type QueryCtx } from "../../_generated/server";
import { buildTelemetrySummary } from "../runtimeTelemetry/runtimeTelemetry";
import { telemetryDashboardArgsValidator } from "../runtimeTelemetry/validators";
import { buildSkillInvocationDashboard } from "../skillInvocations/contracts";
import {
  hookTelemetryRowsToActivityPingRows,
  hookTelemetryRowsToSkillInvocationRows,
  type HookTelemetryRow,
} from "./projections";
import { hookTelemetryWindowArgsValidator } from "./validators";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MAX_DAYS = 90;
const MAX_ROWS = 5000;

type HookTelemetryExplorerEvent = HookTelemetryRow & {
  eventName?: string;
};

type HookTelemetryDistributionRow = {
  key: string;
  count: number;
};

type HookTelemetryWindowArgs = {
  hookName?: string;
  hookType?: string;
  eventName?: string;
  projectId?: string;
  sessionId?: string;
  rangeDays?: number;
  limit?: number;
};

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

function payloadEventName(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return undefined;
  const record = payload as Record<string, unknown>;
  const value = record.eventName ?? record.eventType ?? record.type;
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 120) : undefined;
}

function toExplorerEvent(row: HookTelemetryRow): HookTelemetryExplorerEvent {
  return {
    ...toHookTelemetryRow(row),
    eventName: payloadEventName(row.payload),
  };
}

function buildDistribution(
  rows: HookTelemetryExplorerEvent[],
  getKey: (row: HookTelemetryExplorerEvent) => string | undefined,
): HookTelemetryDistributionRow[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = getKey(row)?.trim() || "unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key))
    .slice(0, 20);
}

async function fetchHookTelemetryRows(
  ctx: QueryCtx,
  args: HookTelemetryWindowArgs,
): Promise<HookTelemetryRow[]> {
  const cutoff = Date.now() - normalizeDays(args.rangeDays) * MS_PER_DAY;
  const limit = normalizeLimit(args.limit);
  if (args.projectId?.trim()) {
    const projectId = args.projectId.trim();
    return await ctx.db
      .query("hookTelemetryEvents")
      .withIndex("by_project_eventAt", (q) => q.eq("projectId", projectId).gte("eventAt", cutoff))
      .order("desc")
      .take(limit);
  }
  if (args.sessionId?.trim()) {
    const sessionId = args.sessionId.trim();
    return await ctx.db
      .query("hookTelemetryEvents")
      .withIndex("by_session_eventAt", (q) => q.eq("sessionId", sessionId).gte("eventAt", cutoff))
      .order("desc")
      .take(limit);
  }
  if (args.hookName?.trim()) {
    const hookName = args.hookName.trim();
    return await ctx.db
      .query("hookTelemetryEvents")
      .withIndex("by_hook_eventAt", (q) => q.eq("hookName", hookName).gte("eventAt", cutoff))
      .order("desc")
      .take(limit);
  }
  return await ctx.db
    .query("hookTelemetryEvents")
    .withIndex("by_eventAt", (q) => q.gte("eventAt", cutoff))
    .order("desc")
    .take(limit);
}

function filterHookTelemetryRows(
  rows: HookTelemetryExplorerEvent[],
  args: HookTelemetryWindowArgs,
): HookTelemetryExplorerEvent[] {
  return rows
    .filter((row) => !args.hookType?.trim() || row.hookType === args.hookType.trim())
    .filter((row) => !args.eventName?.trim() || row.eventName === args.eventName.trim());
}

export const listHookTelemetryEvents = query({
  args: hookTelemetryWindowArgsValidator,
  handler: async (ctx, args) => {
    return filterHookTelemetryRows((await fetchHookTelemetryRows(ctx, args)).map(toExplorerEvent), args).map(
      toHookTelemetryRow,
    );
  },
});

export const getHookTelemetryExplorer = query({
  args: hookTelemetryWindowArgsValidator,
  handler: async (ctx, args) => {
    const events = filterHookTelemetryRows((await fetchHookTelemetryRows(ctx, args)).map(toExplorerEvent), args);

    return {
      events,
      total: events.length,
      distributions: {
        hookNames: buildDistribution(events, (row) => row.hookName),
        hookTypes: buildDistribution(events, (row) => row.hookType),
        eventNames: buildDistribution(events, (row) => row.eventName),
        sessions: buildDistribution(events, (row) => row.sessionId),
      },
    };
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

