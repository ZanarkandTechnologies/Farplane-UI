/**
 * RUNTIME TELEMETRY REDUCERS
 * ==========================
 * Ownership: runtimeTelemetry Convex module.
 * Inputs: Aikage-compatible activity lifecycle rows.
 * Outputs: deterministic runtime turns, scoped summaries, and diagnostic rows.
 * Side effects: none.
 * Invariants: only matched turn_start -> turn_end pairs count as completed agent hours.
 */

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

export type ActivityEventType = "heartbeat" | "turn_start" | "turn_end";
export type ActivityTurnStatus = "completed" | "in_progress" | "unmatched";

export type ActivityPingRow = {
  _id?: string;
  eventType: ActivityEventType;
  source: string;
  activeAgentCount: number;
  prompt?: string;
  agentName?: string;
  workflowName?: string;
  machineName?: string;
  projectName?: string;
  projectDirectory?: string;
  projectId?: string;
  teamId?: string;
  sessionId?: string;
  turnId?: string;
  receivedAt: number;
};

export type RuntimeTurn = {
  id: string;
  machineName: string | null;
  projectName: string | null;
  projectDirectory: string | null;
  projectId: string | null;
  teamId: string | null;
  sessionId: string | null;
  turnId: string;
  agentName: string | null;
  workflowName: string | null;
  source: string;
  prompt: string | null;
  startedAt: number | null;
  endedAt: number | null;
  durationMs: number | null;
  status: ActivityTurnStatus;
};

export type TelemetryBreakdown = {
  key: string;
  displayName: string;
  agentHours: number;
  completedTurnCount: number;
  inProgressTurnCount: number;
  unmatchedTurnCount: number;
  lastSeenAt: number | null;
};

export type TelemetryDayBucket = {
  dayKey: string;
  label: string;
  agentHours: number;
  completedTurnCount: number;
  projectCount: number;
  teamCount: number;
  totalPings: number;
};

export type TelemetrySummary = {
  stats: {
    agentHours: number;
    completedTurnCount: number;
    inProgressTurnCount: number;
    unmatchedTurnCount: number;
    projectCount: number;
    teamCount: number;
    totalPings: number;
    lastSeenAt: number | null;
  };
  projectBreakdown: TelemetryBreakdown[];
  teamBreakdown: TelemetryBreakdown[];
  dailyBuckets: TelemetryDayBucket[];
  recentTurns: RuntimeTurn[];
};

type RuntimeTurnAccumulator = Omit<RuntimeTurn, "durationMs" | "status"> & {
  hasStart: boolean;
  hasEnd: boolean;
};

type BreakdownAccumulator = TelemetryBreakdown & {
  completedTurnKeys: Set<string>;
};

type DayBucketAccumulator = TelemetryDayBucket & {
  projectKeys: Set<string>;
  teamKeys: Set<string>;
};

export function buildRuntimeTurns(rows: ActivityPingRow[]): RuntimeTurn[] {
  const turnsByKey = new Map<string, RuntimeTurnAccumulator>();

  for (const row of rows) {
    if (!row.turnId?.trim()) {
      continue;
    }

    const key = buildTurnKey(row);
    const existing = turnsByKey.get(key);
    const base: RuntimeTurnAccumulator =
      existing ??
      {
        id: key,
        machineName: row.machineName?.trim() || null,
        projectName: row.projectName?.trim() || null,
        projectDirectory: row.projectDirectory?.trim() || null,
        projectId: row.projectId?.trim() || null,
        teamId: row.teamId?.trim() || null,
        sessionId: row.sessionId?.trim() || null,
        turnId: row.turnId.trim(),
        agentName: row.agentName?.trim() || null,
        workflowName: row.workflowName?.trim() || null,
        source: row.source,
        prompt: row.prompt?.trim() || null,
        startedAt: null,
        endedAt: null,
        hasStart: false,
        hasEnd: false,
      };

    const next: RuntimeTurnAccumulator = {
      ...base,
      machineName: base.machineName ?? row.machineName?.trim() ?? null,
      projectName: base.projectName ?? row.projectName?.trim() ?? null,
      projectDirectory: base.projectDirectory ?? row.projectDirectory?.trim() ?? null,
      projectId: base.projectId ?? row.projectId?.trim() ?? null,
      teamId: base.teamId ?? row.teamId?.trim() ?? null,
      sessionId: base.sessionId ?? row.sessionId?.trim() ?? null,
      agentName: base.agentName ?? row.agentName?.trim() ?? null,
      workflowName: base.workflowName ?? row.workflowName?.trim() ?? null,
      source: base.source || row.source,
      prompt: base.prompt ?? row.prompt?.trim() ?? null,
    };

    if (row.eventType === "turn_start") {
      next.hasStart = true;
      next.startedAt =
        next.startedAt === null ? row.receivedAt : Math.min(next.startedAt, row.receivedAt);
      next.source = row.source;
      next.prompt = row.prompt?.trim() || next.prompt;
    }

    if (row.eventType === "turn_end") {
      next.hasEnd = true;
      next.endedAt =
        next.endedAt === null ? row.receivedAt : Math.max(next.endedAt, row.receivedAt);
    }

    turnsByKey.set(key, next);
  }

  return Array.from(turnsByKey.values())
    .map(finalizeTurn)
    .filter((turn) => turn.startedAt !== null || turn.endedAt !== null)
    .sort((left, right) => getTurnSortTime(right) - getTurnSortTime(left));
}

export function buildTelemetrySummary(
  rows: ActivityPingRow[],
  options: { now?: number; days?: number; timezone?: string; recentLimit?: number } = {},
): TelemetrySummary {
  const now = options.now ?? Date.now();
  const days = Math.max(1, Math.min(90, Math.floor(options.days ?? 30)));
  const timezone = normalizeTimezone(options.timezone);
  const recentLimit = Math.max(1, Math.min(120, Math.floor(options.recentLimit ?? 40)));
  const cutoff = now - days * MS_PER_DAY;
  const scopedRows = rows.filter((row) => row.receivedAt >= cutoff);
  const turns = buildRuntimeTurns(scopedRows);
  const projectBreakdown = new Map<string, BreakdownAccumulator>();
  const teamBreakdown = new Map<string, BreakdownAccumulator>();
  const dailyBuckets = initializeDayBuckets(now, days, timezone);
  const projectKeys = new Set<string>();
  const teamKeys = new Set<string>();
  let agentHours = 0;
  let completedTurnCount = 0;
  let inProgressTurnCount = 0;
  let unmatchedTurnCount = 0;
  let lastSeenAt: number | null = null;

  for (const row of scopedRows) {
    const dayBucket = dailyBuckets.get(buildDayKey(row.receivedAt, timezone));
    if (dayBucket) {
      dayBucket.totalPings += 1;
    }
    if (lastSeenAt === null || row.receivedAt > lastSeenAt) {
      lastSeenAt = row.receivedAt;
    }
  }

  for (const turn of turns) {
    const sortTime = getTurnSortTime(turn);
    if (lastSeenAt === null || sortTime > lastSeenAt) {
      lastSeenAt = sortTime;
    }

    const projectKey = buildProjectKey(turn.projectId, turn.projectName, turn.projectDirectory);
    const teamKey = buildTeamKey(turn.teamId, turn.projectId);
    projectKeys.add(projectKey);
    teamKeys.add(teamKey);

    if (turn.status === "in_progress") {
      inProgressTurnCount += 1;
      addDiagnostic(projectBreakdown, projectKey, getProjectDisplayName(turn), "in_progress", sortTime);
      addDiagnostic(teamBreakdown, teamKey, getTeamDisplayName(turn), "in_progress", sortTime);
      continue;
    }

    if (turn.status === "unmatched") {
      unmatchedTurnCount += 1;
      addDiagnostic(projectBreakdown, projectKey, getProjectDisplayName(turn), "unmatched", sortTime);
      addDiagnostic(teamBreakdown, teamKey, getTeamDisplayName(turn), "unmatched", sortTime);
      continue;
    }

    const turnHours = (turn.durationMs ?? 0) / MS_PER_HOUR;
    agentHours += turnHours;
    completedTurnCount += 1;
    addCompleted(projectBreakdown, projectKey, getProjectDisplayName(turn), turn, turnHours);
    addCompleted(teamBreakdown, teamKey, getTeamDisplayName(turn), turn, turnHours);

    if (turn.endedAt !== null) {
      const dayBucket = dailyBuckets.get(buildDayKey(turn.endedAt, timezone));
      if (dayBucket) {
        dayBucket.agentHours += turnHours;
        dayBucket.completedTurnCount += 1;
        dayBucket.projectKeys.add(projectKey);
        dayBucket.teamKeys.add(teamKey);
      }
    }
  }

  return {
    stats: {
      agentHours,
      completedTurnCount,
      inProgressTurnCount,
      unmatchedTurnCount,
      projectCount: projectKeys.size,
      teamCount: teamKeys.size,
      totalPings: scopedRows.length,
      lastSeenAt,
    },
    projectBreakdown: sortBreakdown(projectBreakdown),
    teamBreakdown: sortBreakdown(teamBreakdown),
    dailyBuckets: Array.from(dailyBuckets.values()).map((bucket) => ({
      dayKey: bucket.dayKey,
      label: bucket.label,
      agentHours: bucket.agentHours,
      completedTurnCount: bucket.completedTurnCount,
      projectCount: bucket.projectKeys.size,
      teamCount: bucket.teamKeys.size,
      totalPings: bucket.totalPings,
    })),
    recentTurns: turns.slice(0, recentLimit),
  };
}

function finalizeTurn(turn: RuntimeTurnAccumulator): RuntimeTurn {
  const durationMs =
    turn.startedAt !== null && turn.endedAt !== null && turn.endedAt >= turn.startedAt
      ? turn.endedAt - turn.startedAt
      : null;
  const status: ActivityTurnStatus =
    durationMs !== null ? "completed" : turn.hasStart && !turn.hasEnd ? "in_progress" : "unmatched";
  return {
    ...turn,
    durationMs,
    status,
  };
}

function buildTurnKey(row: ActivityPingRow): string {
  return `${row.sessionId?.trim() || "no-session"}:${row.turnId?.trim() || "no-turn"}`;
}

function getTurnSortTime(turn: RuntimeTurn): number {
  return turn.endedAt ?? turn.startedAt ?? 0;
}

function buildProjectKey(
  projectId: string | null | undefined,
  projectName: string | null | undefined,
  projectDirectory: string | null | undefined,
): string {
  if (projectId?.trim()) return `project-id:${projectId.trim().toLowerCase()}`;
  if (projectDirectory?.trim()) return `project-dir:${hashKey(projectDirectory.trim().toLowerCase())}`;
  if (projectName?.trim()) return `project-name:${hashKey(projectName.trim().toLowerCase())}`;
  return "project:__unknown__";
}

function buildTeamKey(teamId: string | null | undefined, projectId: string | null | undefined): string {
  if (teamId?.trim()) return `team-id:${teamId.trim().toLowerCase()}`;
  if (projectId?.trim()) return `team-id:team-${projectId.trim().toLowerCase()}`;
  return "team:__unknown__";
}

function getProjectDisplayName(turn: RuntimeTurn): string {
  if (turn.projectName?.trim()) return turn.projectName.trim();
  if (turn.projectId?.trim()) return turn.projectId.trim();
  if (turn.projectDirectory?.trim()) {
    const parts = turn.projectDirectory.trim().split("/").filter(Boolean);
    return parts[parts.length - 1] ?? "Unlabeled project";
  }
  return "Unlabeled project";
}

function getTeamDisplayName(turn: RuntimeTurn): string {
  if (turn.teamId?.trim()) return turn.teamId.trim();
  if (turn.projectId?.trim()) return `team-${turn.projectId.trim()}`;
  return "Unlabeled team";
}

function createBreakdown(key: string, displayName: string): BreakdownAccumulator {
  return {
    key,
    displayName,
    agentHours: 0,
    completedTurnCount: 0,
    inProgressTurnCount: 0,
    unmatchedTurnCount: 0,
    lastSeenAt: null,
    completedTurnKeys: new Set(),
  };
}

function addCompleted(
  map: Map<string, BreakdownAccumulator>,
  key: string,
  displayName: string,
  turn: RuntimeTurn,
  turnHours: number,
): void {
  const entry = map.get(key) ?? createBreakdown(key, displayName);
  entry.agentHours += turnHours;
  entry.completedTurnCount += 1;
  entry.completedTurnKeys.add(turn.id);
  const sortTime = getTurnSortTime(turn);
  entry.lastSeenAt = entry.lastSeenAt === null ? sortTime : Math.max(entry.lastSeenAt, sortTime);
  map.set(key, entry);
}

function addDiagnostic(
  map: Map<string, BreakdownAccumulator>,
  key: string,
  displayName: string,
  status: Exclude<ActivityTurnStatus, "completed">,
  sortTime: number,
): void {
  const entry = map.get(key) ?? createBreakdown(key, displayName);
  if (status === "in_progress") {
    entry.inProgressTurnCount += 1;
  } else {
    entry.unmatchedTurnCount += 1;
  }
  entry.lastSeenAt = entry.lastSeenAt === null ? sortTime : Math.max(entry.lastSeenAt, sortTime);
  map.set(key, entry);
}

function sortBreakdown(map: Map<string, BreakdownAccumulator>): TelemetryBreakdown[] {
  return Array.from(map.values())
    .sort((left, right) => right.agentHours - left.agentHours || right.completedTurnCount - left.completedTurnCount)
    .map(({ completedTurnKeys: _completedTurnKeys, ...entry }) => entry);
}

function initializeDayBuckets(now: number, days: number, timezone: string): Map<string, DayBucketAccumulator> {
  const buckets = new Map<string, DayBucketAccumulator>();
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const timestamp = now - offset * MS_PER_DAY;
    const dayKey = buildDayKey(timestamp, timezone);
    buckets.set(dayKey, {
      dayKey,
      label: buildDayLabel(timestamp, timezone),
      agentHours: 0,
      completedTurnCount: 0,
      projectCount: 0,
      teamCount: 0,
      totalPings: 0,
      projectKeys: new Set(),
      teamKeys: new Set(),
    });
  }
  return buckets;
}

function buildDayKey(timestamp: number, timezone: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: timezone,
    year: "numeric",
  });
  return formatter.format(timestamp);
}

function buildDayLabel(timestamp: number, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: timezone,
  }).format(timestamp);
}

function normalizeTimezone(timezone: string | undefined): string {
  if (!timezone?.trim()) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return timezone;
  } catch {
    return "UTC";
  }
}

function hashKey(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
