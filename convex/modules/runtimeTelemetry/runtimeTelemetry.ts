/**
 * RUNTIME TELEMETRY REDUCERS
 * ==========================
 * Ownership: runtimeTelemetry Convex module.
 * Inputs: Aikage-compatible activity lifecycle rows.
 * Outputs: deterministic runtime turns, scoped summaries, and diagnostic rows.
 * Side effects: none.
 * Invariants: completed agent hours come from explicit turn_end rows or same-session next-start recovery.
 */

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;
const DEFAULT_MAX_TURN_DURATION_MS = 4 * MS_PER_HOUR;

export type ActivityEventType = "heartbeat" | "turn_start" | "turn_end";
export type ActivityTurnStatus = "completed" | "in_progress" | "unmatched" | "filtered";
export type ActivityCompletionSource = "explicit_end" | "next_start_recovery";

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
  importKey?: string;
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
  completionSource: ActivityCompletionSource | null;
  filteredReason: "duration_cap" | null;
};

export type TelemetryBreakdown = {
  key: string;
  displayName: string;
  agentHours: number;
  completedTurnCount: number;
  inProgressTurnCount: number;
  unmatchedTurnCount: number;
  lastSeenAt: number | null;
  sourceBreakdowns?: TelemetryBreakdownSource[];
};

export type TelemetryBreakdownSource = {
  key: string;
  displayName: string;
  sourceLabel: string;
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
  longestTurnDurationMs: number | null;
  longestTurnEndedAt: number | null;
  longestTurnProjectDisplayName: string | null;
  availabilityPercent: number;
  coveredHours: number;
  completedTurnCount: number;
  projectCount: number;
  teamCount: number;
  machineCount: number;
  totalPings: number;
  peakConcurrentSessions: number;
  peakConcurrentProjects: number;
  peakOccurredAt: number | null;
  peakProjects: ParallelCapacityProject[];
};

export type TelemetryHourBucket = {
  hourKey: string;
  label: string;
  rangeLabel: string;
  agentHours: number;
  completedTurnCount: number;
  projectCount: number;
  teamCount: number;
  machineCount: number;
  topProjectDisplayName: string | null;
  topTeamDisplayName: string | null;
  topMachineDisplayName: string | null;
};

export type TelemetryAvailabilityHour = {
  hourKey: string;
  label: string;
  rangeLabel: string;
  status: "covered" | "missing" | "pending";
  pingCount: number;
};

export type ParallelCapacityProject = {
  displayName: string;
  sessionCount: number;
  machineCount: number;
};

export type ParallelCapacityDayBucket = {
  dayKey: string;
  label: string;
  peakConcurrentSessions: number;
  peakConcurrentProjects: number;
  peakOccurredAt: number | null;
  peakProjects: ParallelCapacityProject[];
};

export type ParallelCapacityBoard = {
  today: ParallelCapacityDayBucket;
  dailyBuckets: ParallelCapacityDayBucket[];
  maxConcurrentSessions30d: number;
  maxConcurrentProjects30d: number;
};

export type TelemetrySummary = {
  stats: {
    agentHours: number;
    completedTurnCount: number;
    inProgressTurnCount: number;
    unmatchedTurnCount: number;
    filteredTurnCount: number;
    filteredAgentHours: number;
    projectCount: number;
    teamCount: number;
    totalPings: number;
    lastSeenAt: number | null;
  };
  agentHourSummary: {
    todayHours: number;
    yesterdayHours: number;
    deltaHours: number;
    trailingAgentHours: number;
    averageDailyHours: number;
    completedTurnCount: number;
    lastSeenAt: number | null;
  };
  projectBreakdown: TelemetryBreakdown[];
  teamBreakdown: TelemetryBreakdown[];
  projectBreakdownByDay: Record<string, TelemetryBreakdown[]>;
  teamBreakdownByDay: Record<string, TelemetryBreakdown[]>;
  dailyBuckets: TelemetryDayBucket[];
  hourlyBuckets: TelemetryHourBucket[];
  availabilityHours: TelemetryAvailabilityHour[];
  parallelCapacity: ParallelCapacityBoard;
  recentTurns: RuntimeTurn[];
  turnsPage: {
    rows: RuntimeTurn[];
    page: number;
    pageSize: number;
    total: number;
    pageCount: number;
  };
};

type RuntimeTurnAccumulator = Omit<
  RuntimeTurn,
  "durationMs" | "status" | "completionSource" | "filteredReason"
> & {
  hasStart: boolean;
  hasEnd: boolean;
};

type BreakdownAccumulator = TelemetryBreakdownSource & {
  completedTurnKeys: Set<string>;
};

type DayBucketAccumulator = TelemetryDayBucket & {
  bucketStartMs: number;
  bucketEndMs: number;
  coveredHourBuckets: Set<number>;
  projectKeys: Set<string>;
  teamKeys: Set<string>;
  machineKeys: Set<string>;
};

type HourBucketAccumulator = TelemetryHourBucket & {
  bucketStartMs: number;
  bucketEndMs: number;
  projectKeys: Set<string>;
  teamKeys: Set<string>;
  machineKeys: Set<string>;
  projectHours: Map<string, { displayName: string; agentHours: number }>;
  teamHours: Map<string, { displayName: string; agentHours: number }>;
  machineHours: Map<string, { displayName: string; agentHours: number }>;
};

type ParallelInterval = {
  id: string;
  startedAt: number;
  endedAt: number;
  sessionKey: string;
  projectKey: string;
  projectDisplayName: string;
  machineKey: string;
};

type SweepEvent = {
  at: number;
  interval: ParallelInterval;
  kind: "end" | "start";
};

export function buildRuntimeTurns(rows: ActivityPingRow[]): RuntimeTurn[] {
  const turnsByKey = new Map<string, RuntimeTurnAccumulator>();

  for (const row of rows) {
    if (!row.turnId?.trim()) {
      continue;
    }

    const key = buildTurnKey(row);
    const existing = turnsByKey.get(key);
    const base: RuntimeTurnAccumulator = existing ?? {
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

  inferOpenTurnEndsFromNextStarts(turnsByKey);

  return Array.from(turnsByKey.values())
    .map(finalizeTurn)
    .filter((turn) => turn.startedAt !== null || turn.endedAt !== null)
    .sort((left, right) => getTurnSortTime(right) - getTurnSortTime(left));
}

export function buildTelemetrySummary(
  rows: ActivityPingRow[],
  options: {
    now?: number;
    days?: number;
    timezone?: string;
    recentLimit?: number;
    maxTurnDurationMs?: number | null;
    turnPage?: number;
    turnPageSize?: number;
  } = {},
): TelemetrySummary {
  const now = options.now ?? Date.now();
  const days = Math.max(1, Math.min(90, Math.floor(options.days ?? 30)));
  const timezone = normalizeTimezone(options.timezone);
  const recentLimit = Math.max(1, Math.min(120, Math.floor(options.recentLimit ?? 40)));
  const maxTurnDurationMs = normalizeMaxTurnDurationMs(options.maxTurnDurationMs);
  const turnPageSize = Math.max(1, Math.min(100, Math.floor(options.turnPageSize ?? 40)));
  const turnPage = Math.max(1, Math.floor(options.turnPage ?? 1));
  const cutoff = now - days * MS_PER_DAY;
  const scopedRows = rows.filter((row) => row.receivedAt >= cutoff);
  const turns = applyTurnFilters(buildRuntimeTurns(scopedRows), maxTurnDurationMs);
  const projectBreakdown = new Map<string, BreakdownAccumulator>();
  const teamBreakdown = new Map<string, BreakdownAccumulator>();
  const projectBreakdownByDay = new Map<string, Map<string, BreakdownAccumulator>>();
  const teamBreakdownByDay = new Map<string, Map<string, BreakdownAccumulator>>();
  const dailyBuckets = initializeDayBuckets(now, days, timezone);
  const availabilityHourCounts = new Map<number, number>();
  const projectKeys = new Set<string>();
  const teamKeys = new Set<string>();
  let agentHours = 0;
  let completedTurnCount = 0;
  let inProgressTurnCount = 0;
  let unmatchedTurnCount = 0;
  let filteredTurnCount = 0;
  let filteredAgentHours = 0;
  let lastSeenAt: number | null = null;

  for (const row of scopedRows) {
    const dayBucket = dailyBuckets.get(buildDayKey(row.receivedAt, timezone));
    if (dayBucket) {
      dayBucket.totalPings += 1;
      const hourBucketStart = Math.floor(row.receivedAt / MS_PER_HOUR) * MS_PER_HOUR;
      dayBucket.coveredHourBuckets.add(hourBucketStart);
      availabilityHourCounts.set(
        hourBucketStart,
        (availabilityHourCounts.get(hourBucketStart) ?? 0) + 1,
      );
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
    const machineKey = buildMachineKey(turn.machineName);
    projectKeys.add(projectKey);
    teamKeys.add(teamKey);

    if (turn.status === "in_progress") {
      inProgressTurnCount += 1;
      addDiagnostic(
        projectBreakdown,
        projectKey,
        getProjectDisplayName(turn),
        "in_progress",
        sortTime,
        getProjectSourceLabel(turn),
      );
      addDiagnostic(teamBreakdown, teamKey, getTeamDisplayName(turn), "in_progress", sortTime);
      continue;
    }

    if (turn.status === "unmatched") {
      unmatchedTurnCount += 1;
      addDiagnostic(
        projectBreakdown,
        projectKey,
        getProjectDisplayName(turn),
        "unmatched",
        sortTime,
        getProjectSourceLabel(turn),
      );
      addDiagnostic(teamBreakdown, teamKey, getTeamDisplayName(turn), "unmatched", sortTime);
      continue;
    }

    if (turn.status === "filtered") {
      filteredTurnCount += 1;
      filteredAgentHours += (turn.durationMs ?? 0) / MS_PER_HOUR;
      addDiagnostic(
        projectBreakdown,
        projectKey,
        getProjectDisplayName(turn),
        "filtered",
        sortTime,
        getProjectSourceLabel(turn),
      );
      addDiagnostic(teamBreakdown, teamKey, getTeamDisplayName(turn), "filtered", sortTime);
      continue;
    }

    const durationMs = turn.durationMs ?? 0;
    const turnHours = durationMs / MS_PER_HOUR;
    agentHours += turnHours;
    completedTurnCount += 1;
    addCompleted(
      projectBreakdown,
      projectKey,
      getProjectDisplayName(turn),
      turn,
      turnHours,
      getProjectSourceLabel(turn),
    );
    addCompleted(teamBreakdown, teamKey, getTeamDisplayName(turn), turn, turnHours);

    if (turn.endedAt !== null) {
      const dayKey = buildDayKey(turn.endedAt, timezone);
      const dayBucket = dailyBuckets.get(dayKey);
      if (dayBucket) {
        dayBucket.agentHours += turnHours;
        dayBucket.completedTurnCount += 1;
        dayBucket.projectKeys.add(projectKey);
        dayBucket.teamKeys.add(teamKey);
        dayBucket.machineKeys.add(machineKey);
        if (
          dayBucket.longestTurnDurationMs === null ||
          durationMs > dayBucket.longestTurnDurationMs
        ) {
          dayBucket.longestTurnDurationMs = durationMs;
          dayBucket.longestTurnEndedAt = turn.endedAt;
          dayBucket.longestTurnProjectDisplayName = getProjectDisplayName(turn);
        }
      }
      addCompleted(
        getOrCreateBreakdownMap(projectBreakdownByDay, dayKey),
        projectKey,
        getProjectDisplayName(turn),
        turn,
        turnHours,
        getProjectSourceLabel(turn),
      );
      addCompleted(
        getOrCreateBreakdownMap(teamBreakdownByDay, dayKey),
        teamKey,
        getTeamDisplayName(turn),
        turn,
        turnHours,
      );
    }
  }

  const pageStart = (turnPage - 1) * turnPageSize;
  const pageCount = Math.max(1, Math.ceil(turns.length / turnPageSize));
  const dailyBucketValues = Array.from(dailyBuckets.values());
  const parallelCapacity = buildDailyParallelCapacity(turns, dailyBucketValues);
  const finalDailyBuckets = dailyBucketValues.map((bucket) => {
    const parallelBucket = parallelCapacity.dailyBuckets.find(
      (item) => item.dayKey === bucket.dayKey,
    );
    return {
      dayKey: bucket.dayKey,
      label: bucket.label,
      agentHours: bucket.agentHours,
      longestTurnDurationMs: bucket.longestTurnDurationMs,
      longestTurnEndedAt: bucket.longestTurnEndedAt,
      longestTurnProjectDisplayName: bucket.longestTurnProjectDisplayName,
      availabilityPercent: Math.round((bucket.coveredHourBuckets.size / 24) * 100),
      coveredHours: bucket.coveredHourBuckets.size,
      completedTurnCount: bucket.completedTurnCount,
      projectCount: bucket.projectKeys.size,
      teamCount: bucket.teamKeys.size,
      machineCount: bucket.machineKeys.size,
      totalPings: bucket.totalPings,
      peakConcurrentSessions: parallelBucket?.peakConcurrentSessions ?? 0,
      peakConcurrentProjects: parallelBucket?.peakConcurrentProjects ?? 0,
      peakOccurredAt: parallelBucket?.peakOccurredAt ?? null,
      peakProjects: parallelBucket?.peakProjects ?? [],
    };
  });
  const todayKey = buildDayKey(now, timezone);
  const todayIndex = finalDailyBuckets.findIndex((bucket) => bucket.dayKey === todayKey);
  const todayBucket =
    todayIndex >= 0
      ? finalDailyBuckets[todayIndex]
      : finalDailyBuckets[finalDailyBuckets.length - 1];
  const yesterdayBucket =
    todayIndex > 0
      ? finalDailyBuckets[todayIndex - 1]
      : finalDailyBuckets[finalDailyBuckets.length - 2];

  return {
    stats: {
      agentHours,
      completedTurnCount,
      inProgressTurnCount,
      unmatchedTurnCount,
      filteredTurnCount,
      filteredAgentHours,
      projectCount: projectKeys.size,
      teamCount: teamKeys.size,
      totalPings: scopedRows.length,
      lastSeenAt,
    },
    agentHourSummary: {
      todayHours: todayBucket?.agentHours ?? 0,
      yesterdayHours: yesterdayBucket?.agentHours ?? 0,
      deltaHours: (todayBucket?.agentHours ?? 0) - (yesterdayBucket?.agentHours ?? 0),
      trailingAgentHours: agentHours,
      averageDailyHours: agentHours / days,
      completedTurnCount,
      lastSeenAt,
    },
    projectBreakdown: rollUpProjectBreakdowns(sortBreakdown(projectBreakdown)),
    teamBreakdown: sortBreakdown(teamBreakdown),
    projectBreakdownByDay: buildBreakdownByDay(projectBreakdownByDay, dailyBucketValues),
    teamBreakdownByDay: buildBreakdownByDay(teamBreakdownByDay, dailyBucketValues),
    dailyBuckets: finalDailyBuckets,
    hourlyBuckets: buildHourlyBuckets(turns, now, timezone),
    availabilityHours: buildAvailabilityHours(now, timezone, availabilityHourCounts),
    parallelCapacity,
    recentTurns: turns.slice(0, recentLimit),
    turnsPage: {
      rows: turns.slice(pageStart, pageStart + turnPageSize),
      page: turnPage,
      pageSize: turnPageSize,
      total: turns.length,
      pageCount,
    },
  };
}

function finalizeTurn(turn: RuntimeTurnAccumulator): RuntimeTurn {
  const durationMs =
    turn.startedAt !== null && turn.endedAt !== null && turn.endedAt >= turn.startedAt
      ? turn.endedAt - turn.startedAt
      : null;
  const status: ActivityTurnStatus =
    durationMs !== null ? "completed" : turn.hasStart && !turn.hasEnd ? "in_progress" : "unmatched";
  const { hasStart: _hasStart, hasEnd: _hasEnd, ...runtimeTurn } = turn;
  return {
    ...runtimeTurn,
    durationMs,
    status,
    completionSource:
      status === "completed" ? (turn.hasEnd ? "explicit_end" : "next_start_recovery") : null,
    filteredReason: null,
  };
}

function applyTurnFilters(turns: RuntimeTurn[], maxTurnDurationMs: number | null): RuntimeTurn[] {
  if (maxTurnDurationMs === null) return turns;
  return turns.map((turn) => {
    if (
      turn.status !== "completed" ||
      turn.durationMs === null ||
      turn.durationMs <= maxTurnDurationMs
    ) {
      return turn;
    }
    return {
      ...turn,
      status: "filtered",
      filteredReason: "duration_cap",
    };
  });
}

function inferOpenTurnEndsFromNextStarts(turnsByKey: Map<string, RuntimeTurnAccumulator>): void {
  const startsBySession = new Map<string, RuntimeTurnAccumulator[]>();
  for (const turn of turnsByKey.values()) {
    if (!turn.sessionId || !turn.hasStart || turn.startedAt === null) {
      continue;
    }
    const turns = startsBySession.get(turn.sessionId) ?? [];
    turns.push(turn);
    startsBySession.set(turn.sessionId, turns);
  }

  for (const turns of startsBySession.values()) {
    turns.sort((left, right) => {
      const timeDelta = (left.startedAt ?? 0) - (right.startedAt ?? 0);
      return timeDelta || left.turnId.localeCompare(right.turnId);
    });

    for (let index = 0; index < turns.length - 1; index += 1) {
      const current = turns[index];
      const next = turns[index + 1];
      if (!current || !next || current.hasEnd || current.endedAt !== null) {
        continue;
      }
      if (next.startedAt === null || next.startedAt <= (current.startedAt ?? 0)) {
        continue;
      }
      current.endedAt = next.startedAt;
    }
  }
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
  if (projectDirectory?.trim())
    return `project-dir:${hashKey(projectDirectory.trim().toLowerCase())}`;
  if (projectName?.trim()) return `project-name:${hashKey(projectName.trim().toLowerCase())}`;
  return "project:__unknown__";
}

function buildTeamKey(
  teamId: string | null | undefined,
  projectId: string | null | undefined,
): string {
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

function getProjectSourceLabel(turn: RuntimeTurn): string {
  if (turn.projectId?.trim()) return `project id: ${turn.projectId.trim()}`;
  if (turn.projectDirectory?.trim()) {
    const parts = turn.projectDirectory.trim().split("/").filter(Boolean);
    const directoryName = parts[parts.length - 1] ?? "directory";
    return `directory: ${directoryName}`;
  }
  if (turn.projectName?.trim()) return `project name: ${turn.projectName.trim()}`;
  return "unlabeled source";
}

function getTeamDisplayName(turn: RuntimeTurn): string {
  if (turn.teamId?.trim()) return turn.teamId.trim();
  if (turn.projectId?.trim()) return `team-${turn.projectId.trim()}`;
  return "Unlabeled team";
}

function createBreakdown(
  key: string,
  displayName: string,
  sourceLabel = key,
): BreakdownAccumulator {
  return {
    key,
    displayName,
    sourceLabel,
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
  sourceLabel = key,
): void {
  const entry = map.get(key) ?? createBreakdown(key, displayName, sourceLabel);
  entry.sourceLabel = sourceLabel;
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
  sourceLabel = key,
): void {
  const entry = map.get(key) ?? createBreakdown(key, displayName, sourceLabel);
  entry.sourceLabel = sourceLabel;
  if (status === "in_progress") {
    entry.inProgressTurnCount += 1;
  } else if (status === "unmatched") {
    entry.unmatchedTurnCount += 1;
  }
  entry.lastSeenAt = entry.lastSeenAt === null ? sortTime : Math.max(entry.lastSeenAt, sortTime);
  map.set(key, entry);
}

function sortBreakdown(map: Map<string, BreakdownAccumulator>): TelemetryBreakdownSource[] {
  return Array.from(map.values())
    .sort(
      (left, right) =>
        right.agentHours - left.agentHours || right.completedTurnCount - left.completedTurnCount,
    )
    .map(({ completedTurnKeys: _completedTurnKeys, ...entry }) => entry);
}

function rollUpProjectBreakdowns(rows: TelemetryBreakdownSource[]): TelemetryBreakdown[] {
  const groups = new Map<
    string,
    Omit<TelemetryBreakdown, "sourceBreakdowns"> & { sourceBreakdowns: TelemetryBreakdownSource[] }
  >();

  for (const row of rows) {
    const displayName = row.displayName.trim() || "Unlabeled project";
    const groupKey = `project-display:${hashKey(displayName.toLowerCase())}`;
    const group = groups.get(groupKey) ?? {
      key: groupKey,
      displayName,
      agentHours: 0,
      completedTurnCount: 0,
      inProgressTurnCount: 0,
      unmatchedTurnCount: 0,
      lastSeenAt: null,
      sourceBreakdowns: [],
    };

    group.agentHours += row.agentHours;
    group.completedTurnCount += row.completedTurnCount;
    group.inProgressTurnCount += row.inProgressTurnCount;
    group.unmatchedTurnCount += row.unmatchedTurnCount;
    group.lastSeenAt =
      group.lastSeenAt === null
        ? row.lastSeenAt
        : row.lastSeenAt === null
          ? group.lastSeenAt
          : Math.max(group.lastSeenAt, row.lastSeenAt);
    group.sourceBreakdowns.push(row);
    groups.set(groupKey, group);
  }

  return Array.from(groups.values())
    .map((group) => {
      const sources = group.sourceBreakdowns.sort(
        (left, right) =>
          right.agentHours - left.agentHours || right.completedTurnCount - left.completedTurnCount,
      );
      return {
        ...group,
        sourceBreakdowns: sources.length > 1 ? sources : undefined,
      };
    })
    .sort(
      (left, right) =>
        right.agentHours - left.agentHours || right.completedTurnCount - left.completedTurnCount,
    );
}

function getOrCreateBreakdownMap(
  map: Map<string, Map<string, BreakdownAccumulator>>,
  dayKey: string,
): Map<string, BreakdownAccumulator> {
  const existing = map.get(dayKey);
  if (existing) return existing;
  const next = new Map<string, BreakdownAccumulator>();
  map.set(dayKey, next);
  return next;
}

function buildBreakdownByDay(
  map: Map<string, Map<string, BreakdownAccumulator>>,
  buckets: DayBucketAccumulator[],
): Record<string, TelemetryBreakdown[]> {
  return Object.fromEntries(
    buckets.map((bucket) => [bucket.dayKey, sortBreakdown(map.get(bucket.dayKey) ?? new Map())]),
  );
}

function buildHourlyBuckets(
  turns: RuntimeTurn[],
  now: number,
  timezone: string,
): TelemetryHourBucket[] {
  const currentHourStart = Math.floor(now / MS_PER_HOUR) * MS_PER_HOUR;
  const buckets = new Map<number, HourBucketAccumulator>();

  for (let offset = 23; offset >= 0; offset -= 1) {
    const bucketStartMs = currentHourStart - offset * MS_PER_HOUR;
    buckets.set(bucketStartMs, {
      hourKey: String(bucketStartMs),
      label: buildHourLabel(bucketStartMs, timezone),
      rangeLabel: buildHourRangeLabel(bucketStartMs, timezone),
      agentHours: 0,
      completedTurnCount: 0,
      projectCount: 0,
      teamCount: 0,
      machineCount: 0,
      topProjectDisplayName: null,
      topTeamDisplayName: null,
      topMachineDisplayName: null,
      bucketStartMs,
      bucketEndMs: bucketStartMs + MS_PER_HOUR,
      projectKeys: new Set(),
      teamKeys: new Set(),
      machineKeys: new Set(),
      projectHours: new Map(),
      teamHours: new Map(),
      machineHours: new Map(),
    });
  }

  for (const turn of turns) {
    if (turn.status !== "completed" || turn.durationMs === null || turn.endedAt === null) {
      continue;
    }
    const bucketStartMs = Math.floor(turn.endedAt / MS_PER_HOUR) * MS_PER_HOUR;
    const bucket = buckets.get(bucketStartMs);
    if (!bucket) continue;

    const turnHours = turn.durationMs / MS_PER_HOUR;
    const projectKey = buildProjectKey(turn.projectId, turn.projectName, turn.projectDirectory);
    const teamKey = buildTeamKey(turn.teamId, turn.projectId);
    const machineKey = buildMachineKey(turn.machineName);
    bucket.agentHours += turnHours;
    bucket.completedTurnCount += 1;
    bucket.projectKeys.add(projectKey);
    bucket.teamKeys.add(teamKey);
    bucket.machineKeys.add(machineKey);
    addHourlyTotal(bucket.projectHours, projectKey, getProjectDisplayName(turn), turnHours);
    addHourlyTotal(bucket.teamHours, teamKey, getTeamDisplayName(turn), turnHours);
    addHourlyTotal(
      bucket.machineHours,
      machineKey,
      getMachineDisplayName(turn.machineName),
      turnHours,
    );
  }

  return Array.from(buckets.values()).map((bucket) => ({
    hourKey: bucket.hourKey,
    label: bucket.label,
    rangeLabel: bucket.rangeLabel,
    agentHours: bucket.agentHours,
    completedTurnCount: bucket.completedTurnCount,
    projectCount: bucket.projectKeys.size,
    teamCount: bucket.teamKeys.size,
    machineCount: bucket.machineKeys.size,
    topProjectDisplayName: getTopHourlyLabel(bucket.projectHours),
    topTeamDisplayName: getTopHourlyLabel(bucket.teamHours),
    topMachineDisplayName: getTopHourlyLabel(bucket.machineHours),
  }));
}

function addHourlyTotal(
  map: Map<string, { displayName: string; agentHours: number }>,
  key: string,
  displayName: string,
  agentHours: number,
): void {
  const current = map.get(key) ?? { displayName, agentHours: 0 };
  current.agentHours += agentHours;
  map.set(key, current);
}

function getTopHourlyLabel(
  map: Map<string, { displayName: string; agentHours: number }>,
): string | null {
  const top = Array.from(map.values()).sort((left, right) => right.agentHours - left.agentHours)[0];
  return top?.displayName ?? null;
}

function buildAvailabilityHours(
  now: number,
  timezone: string,
  availabilityHourCounts: Map<number, number>,
): TelemetryAvailabilityHour[] {
  const todayKey = buildDayKey(now, timezone);
  const currentHourStart = Math.floor(now / MS_PER_HOUR) * MS_PER_HOUR;
  const candidates: number[] = [];

  for (let offset = -24; offset <= 24; offset += 1) {
    const bucketStartMs = currentHourStart + offset * MS_PER_HOUR;
    if (buildDayKey(bucketStartMs, timezone) === todayKey) {
      candidates.push(bucketStartMs);
    }
  }

  return candidates
    .sort((left, right) => left - right)
    .slice(0, 24)
    .map((bucketStartMs) => {
      const pingCount = availabilityHourCounts.get(bucketStartMs) ?? 0;
      const status: TelemetryAvailabilityHour["status"] =
        pingCount > 0 ? "covered" : bucketStartMs + MS_PER_HOUR <= now ? "missing" : "pending";
      return {
        hourKey: String(bucketStartMs),
        label: buildHourLabel(bucketStartMs, timezone),
        rangeLabel: buildHourRangeLabel(bucketStartMs, timezone),
        status,
        pingCount,
      };
    });
}

function buildDailyParallelCapacity(
  turns: RuntimeTurn[],
  buckets: DayBucketAccumulator[],
): ParallelCapacityBoard {
  const dailyBuckets = buckets.map<ParallelCapacityDayBucket>((bucket) => {
    const peak = findPeakOverlap(
      buildIntervalsForWindow(turns, bucket.bucketStartMs, bucket.bucketEndMs),
    );
    return {
      dayKey: bucket.dayKey,
      label: bucket.label,
      peakConcurrentSessions: peak.concurrentSessions,
      peakConcurrentProjects: peak.concurrentProjects,
      peakOccurredAt: peak.occurredAt,
      peakProjects: peak.projects,
    };
  });
  const today = dailyBuckets[dailyBuckets.length - 1] ?? {
    dayKey: "",
    label: "Today",
    peakConcurrentSessions: 0,
    peakConcurrentProjects: 0,
    peakOccurredAt: null,
    peakProjects: [],
  };

  return {
    today,
    dailyBuckets,
    maxConcurrentSessions30d: Math.max(
      0,
      ...dailyBuckets.map((bucket) => bucket.peakConcurrentSessions),
    ),
    maxConcurrentProjects30d: Math.max(
      0,
      ...dailyBuckets.map((bucket) => bucket.peakConcurrentProjects),
    ),
  };
}

function buildIntervalsForWindow(
  turns: RuntimeTurn[],
  windowStartMs: number,
  windowEndMs: number,
): ParallelInterval[] {
  return turns.flatMap((turn) => {
    if (
      turn.status !== "completed" ||
      turn.startedAt === null ||
      turn.endedAt === null ||
      turn.endedAt <= turn.startedAt
    ) {
      return [];
    }

    const startedAt = Math.max(turn.startedAt, windowStartMs);
    const endedAt = Math.min(turn.endedAt, windowEndMs);
    if (endedAt <= startedAt) {
      return [];
    }

    return [
      {
        id: `${turn.id}:${startedAt}:${endedAt}`,
        startedAt,
        endedAt,
        sessionKey: turn.sessionId?.trim()
          ? `session:${turn.sessionId.trim()}`
          : `turn:${turn.turnId}`,
        projectKey: buildProjectKey(turn.projectId, turn.projectName, turn.projectDirectory),
        projectDisplayName: getProjectDisplayName(turn),
        machineKey: buildMachineKey(turn.machineName),
      },
    ];
  });
}

function findPeakOverlap(intervals: ParallelInterval[]): {
  concurrentProjects: number;
  concurrentSessions: number;
  occurredAt: number | null;
  projects: ParallelCapacityProject[];
} {
  const events = intervals.flatMap<SweepEvent>((interval) => [
    { at: interval.startedAt, interval, kind: "start" },
    { at: interval.endedAt, interval, kind: "end" },
  ]);
  events.sort((left, right) => {
    if (left.at !== right.at) return left.at - right.at;
    return left.kind === right.kind ? 0 : left.kind === "end" ? -1 : 1;
  });

  const activeIntervals = new Map<string, ParallelInterval>();
  let peakOccurredAt: number | null = null;
  let peakSessions = 0;
  let peakProjects = 0;
  let peakActiveIntervals: ParallelInterval[] = [];

  for (const event of events) {
    if (event.kind === "end") {
      activeIntervals.delete(event.interval.id);
      continue;
    }

    activeIntervals.set(event.interval.id, event.interval);
    const active = Array.from(activeIntervals.values());
    const concurrentSessions = new Set(active.map((interval) => interval.sessionKey)).size;
    const concurrentProjects = new Set(active.map((interval) => interval.projectKey)).size;
    if (
      concurrentSessions > peakSessions ||
      (concurrentSessions === peakSessions && concurrentProjects > peakProjects)
    ) {
      peakSessions = concurrentSessions;
      peakProjects = concurrentProjects;
      peakOccurredAt = event.at;
      peakActiveIntervals = active;
    }
  }

  return {
    concurrentProjects: peakProjects,
    concurrentSessions: peakSessions,
    occurredAt: peakOccurredAt,
    projects: buildPeakProjects(peakActiveIntervals),
  };
}

function buildPeakProjects(intervals: ParallelInterval[]): ParallelCapacityProject[] {
  const projects = new Map<
    string,
    {
      displayName: string;
      machineKeys: Set<string>;
      sessionKeys: Set<string>;
    }
  >();
  for (const interval of intervals) {
    const current = projects.get(interval.projectKey) ?? {
      displayName: interval.projectDisplayName,
      machineKeys: new Set<string>(),
      sessionKeys: new Set<string>(),
    };
    current.machineKeys.add(interval.machineKey);
    current.sessionKeys.add(interval.sessionKey);
    projects.set(interval.projectKey, current);
  }

  return Array.from(projects.values())
    .map((project) => ({
      displayName: project.displayName,
      machineCount: project.machineKeys.size,
      sessionCount: project.sessionKeys.size,
    }))
    .sort(
      (left, right) =>
        right.sessionCount - left.sessionCount || left.displayName.localeCompare(right.displayName),
    );
}

function initializeDayBuckets(
  now: number,
  days: number,
  timezone: string,
): Map<string, DayBucketAccumulator> {
  const buckets = new Map<string, DayBucketAccumulator>();
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const timestamp = now - offset * MS_PER_DAY;
    const bucketStartMs = Math.floor(timestamp / MS_PER_DAY) * MS_PER_DAY;
    const dayKey = buildDayKey(timestamp, timezone);
    buckets.set(dayKey, {
      dayKey,
      label: buildDayLabel(timestamp, timezone),
      agentHours: 0,
      longestTurnDurationMs: null,
      longestTurnEndedAt: null,
      longestTurnProjectDisplayName: null,
      availabilityPercent: 0,
      coveredHours: 0,
      completedTurnCount: 0,
      projectCount: 0,
      teamCount: 0,
      machineCount: 0,
      totalPings: 0,
      peakConcurrentSessions: 0,
      peakConcurrentProjects: 0,
      peakOccurredAt: null,
      peakProjects: [],
      bucketStartMs,
      bucketEndMs: bucketStartMs + MS_PER_DAY,
      coveredHourBuckets: new Set(),
      projectKeys: new Set(),
      teamKeys: new Set(),
      machineKeys: new Set(),
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

function buildHourLabel(timestamp: number, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hour12: false,
    timeZone: timezone,
  }).format(timestamp);
}

function buildHourRangeLabel(timestamp: number, timezone: string): string {
  const start = buildHourLabel(timestamp, timezone);
  const end = buildHourLabel(timestamp + MS_PER_HOUR, timezone);
  return `${start}:00-${end}:00`;
}

function buildMachineKey(machineName: string | null | undefined): string {
  const name = machineName?.trim();
  return name ? `machine:${name.toLowerCase()}` : "machine:__unknown__";
}

function getMachineDisplayName(machineName: string | null | undefined): string {
  return machineName?.trim() ? machineName.trim() : "Unlabeled machine";
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

function normalizeMaxTurnDurationMs(value: number | null | undefined): number | null {
  if (value === null) return null;
  if (value === undefined) return DEFAULT_MAX_TURN_DURATION_MS;
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_MAX_TURN_DURATION_MS;
  return Math.min(24 * MS_PER_HOUR, Math.max(15 * 60_000, Math.floor(value)));
}

function hashKey(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
