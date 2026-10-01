import { type QueryCtx, query } from "../../_generated/server";
import { buildTelemetrySummary } from "../runtimeTelemetry/runtimeTelemetry";
import { telemetryDashboardArgsValidator } from "../runtimeTelemetry/validators";
import { buildSkillInvocationDashboard } from "../skillInvocations/contracts";
import { hookTelemetryRowsToLearningTimelineRows } from "./learningTimeline";
import {
  type HookTelemetryRow,
  hookTelemetryRowsToActivityPingRows,
  hookTelemetryRowsToAgentBubbleMessages,
  hookTelemetryRowsToObservedCodexWorkers,
  hookTelemetryRowsToOfficeTravelIntents,
  hookTelemetryRowsToSkillInvocationRows,
  hookTelemetryRowsToThreadLineageGraph,
} from "./projections";
import {
  hookTelemetryBubbleArgsValidator,
  hookTelemetryWindowArgsValidator,
  learningTimelineArgsValidator,
  observedCodexWorkersArgsValidator,
  threadLineageGraphArgsValidator,
} from "./validators";
import { readHookRows } from "../telemetry/reads";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MAX_DAYS = 90;
const MAX_ROWS = 5000;
const DEFAULT_BUBBLE_RANGE_MS = 30_000;
const MAX_BUBBLE_RANGE_MS = 10 * 60 * 1000;
const DEFAULT_OBSERVED_WORKER_RANGE_MS = 15 * 60 * 1000;
const MAX_OBSERVED_WORKER_RANGE_MS = 24 * 60 * 60 * 1000;

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

function buildDistribution<Row>(
  rows: Row[],
  getKey: (row: Row) => string | undefined,
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
  const since = Date.now() - normalizeDays(args.rangeDays) * MS_PER_DAY;
  const limit = normalizeLimit(args.limit);
  // One scope per read, in this order (the explorer filters hookType and eventName afterwards).
  const projectId = args.projectId?.trim();
  if (projectId) return await readHookRows(ctx, { projectId, since, limit });
  const sessionId = args.sessionId?.trim();
  if (sessionId) return await readHookRows(ctx, { sessionId, since, limit });
  const hookName = args.hookName?.trim();
  if (hookName) return await readHookRows(ctx, { hookName, since, limit });
  return await readHookRows(ctx, { since, limit });
}

function filterHookTelemetryRows(
  rows: HookTelemetryExplorerEvent[],
  args: HookTelemetryWindowArgs,
): HookTelemetryExplorerEvent[] {
  return rows
    .filter((row) => !args.hookType?.trim() || row.hookType === args.hookType.trim())
    .filter((row) => !args.eventName?.trim() || row.eventName === args.eventName.trim());
}

async function fetchThreadLineageSourceRows(
  ctx: QueryCtx,
  args: HookTelemetryWindowArgs,
  source: { hookName: string; hookType?: string },
): Promise<HookTelemetryRow[]> {
  const since = Date.now() - normalizeDays(args.rangeDays) * MS_PER_DAY;
  const limit = normalizeLimit(args.limit);
  const projectId = args.projectId?.trim();
  const sessionId = projectId ? undefined : args.sessionId?.trim();
  return await readHookRows(ctx, {
    projectId,
    sessionId,
    hookName: source.hookName,
    hookType: source.hookType,
    since,
    limit,
  });
}

export const listHookTelemetryEvents = query({
  args: hookTelemetryWindowArgsValidator,
  handler: async (ctx, args) => {
    return filterHookTelemetryRows(
      (await fetchHookTelemetryRows(ctx, args)).map(toExplorerEvent),
      args,
    ).map(toHookTelemetryRow);
  },
});

export const getHookTelemetryExplorer = query({
  args: hookTelemetryWindowArgsValidator,
  handler: async (ctx, args) => {
    const events = filterHookTelemetryRows(
      (await fetchHookTelemetryRows(ctx, args)).map(toExplorerEvent),
      args,
    );

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
    const rows = await readHookRows(ctx, {
      hookName: "skill-invocation-listener",
      since: Date.now() - normalizeDays(args.rangeDays) * MS_PER_DAY,
      limit: MAX_ROWS,
    });
    return buildSkillInvocationDashboard(
      hookTelemetryRowsToSkillInvocationRows(rows.map(toHookTelemetryRow)),
      {
        limit: args.limit,
      },
    );
  },
});

export const getRuntimeTelemetryDashboardFromHookTelemetry = query({
  args: telemetryDashboardArgsValidator,
  handler: async (ctx, args) => {
    const days = normalizeDays(args.rangeDays);
    const rows = await readHookRows(ctx, { since: Date.now() - days * MS_PER_DAY, limit: MAX_ROWS });
    return buildTelemetrySummary(
      hookTelemetryRowsToActivityPingRows(rows.map(toHookTelemetryRow)),
      {
        days,
        now: Date.now(),
        timezone: args.timezone,
        maxTurnDurationMs: args.maxTurnDurationMs,
        turnPage: args.turnPage,
        turnPageSize: args.turnPageSize,
      },
    );
  },
});

export const getObservedCodexWorkers = query({
  args: observedCodexWorkersArgsValidator,
  handler: async (ctx, args) => {
    const rangeMs = Math.max(
      5_000,
      Math.min(
        MAX_OBSERVED_WORKER_RANGE_MS,
        Math.floor(args.rangeMs ?? DEFAULT_OBSERVED_WORKER_RANGE_MS),
      ),
    );
    const cutoff = Date.now() - rangeMs;
    const limit = normalizeLimit(args.limit);
    const projectId = args.projectId?.trim();
    const rows = await readHookRows(ctx, { projectId: projectId || undefined, since: cutoff, limit });

    return {
      workers: hookTelemetryRowsToObservedCodexWorkers(rows.map(toHookTelemetryRow)),
      rangeMs,
    };
  },
});

export const getThreadLineageGraph = query({
  args: threadLineageGraphArgsValidator,
  handler: async (ctx, args) => {
    const rows = (
      await Promise.all([
        fetchThreadLineageSourceRows(ctx, args, { hookName: "thread-lineage-listener" }),
        fetchThreadLineageSourceRows(ctx, args, { hookName: "thread-lineage-backfill" }),
        fetchThreadLineageSourceRows(ctx, args, {
          hookName: "farplane-console-ping",
          hookType: "SubagentStart",
        }),
      ])
    ).flat();
    return hookTelemetryRowsToThreadLineageGraph(rows.map(toHookTelemetryRow));
  },
});

export const getLearningTimelineFromHookTelemetry = query({
  args: learningTimelineArgsValidator,
  handler: async (ctx, args) => {
    const rawLimit = MAX_ROWS;
    const rows = await fetchHookTelemetryRows(ctx, {
      projectId: args.projectId,
      sessionId: args.sessionId,
      eventName: args.eventName,
      rangeDays: args.rangeDays,
      limit: rawLimit,
    });
    const timeline = hookTelemetryRowsToLearningTimelineRows(rows.map(toHookTelemetryRow))
      .filter((row) => !args.ticketId?.trim() || row.ticketId === args.ticketId.trim())
      .filter((row) => !args.eventName?.trim() || row.eventName === args.eventName.trim())
      .filter(
        (row) => !args.sourceProgram?.trim() || row.sourceProgram === args.sourceProgram.trim(),
      )
      .slice(0, normalizeLimit(args.limit));

    return {
      rows: timeline,
      total: timeline.length,
      distributions: {
        eventNames: buildDistribution(timeline, (row) => row.eventName),
        tickets: buildDistribution(timeline, (row) => row.ticketId),
        sessions: buildDistribution(timeline, (row) => row.sessionId),
        sourcePrograms: buildDistribution(timeline, (row) => row.sourceProgram),
      },
    };
  },
});

export const getRecentBubbleMessages = query({
  args: hookTelemetryBubbleArgsValidator,
  handler: async (ctx, args) => {
    const rangeMs = Math.max(
      1_000,
      Math.min(MAX_BUBBLE_RANGE_MS, Math.floor(args.rangeMs ?? DEFAULT_BUBBLE_RANGE_MS)),
    );
    const cutoff = Date.now() - rangeMs;
    const limit = normalizeLimit(args.limit);
    const sessionIds = [
      ...new Set((args.sessionIds ?? []).map((entry) => entry.trim()).filter(Boolean)),
    ];
    const projectId = args.projectId?.trim();

    const rows =
      sessionIds.length > 0
        ? (
            await Promise.all(
              sessionIds.map((sessionId) => readHookRows(ctx, { sessionId, since: cutoff, limit })),
            )
          ).flat()
        : await readHookRows(ctx, { projectId: projectId || undefined, since: cutoff, limit });

    const sortedRows = rows
      .map(toHookTelemetryRow)
      .sort((left, right) => right.eventAt - left.eventAt);
    const limitedRows = sortedRows.slice(0, limit);
    return {
      messages: hookTelemetryRowsToAgentBubbleMessages(limitedRows),
      travelIntents: hookTelemetryRowsToOfficeTravelIntents(limitedRows),
    };
  },
});
