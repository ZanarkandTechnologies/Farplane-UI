/**
 * TELEMETRY DASHBOARD TYPES
 * =========================
 * Ownership: Telemetry module.
 * Inputs: Convex runtime telemetry query payloads.
 * Outputs: UI-local TypeScript contracts shared by telemetry dashboard views.
 * Side effects: none.
 * Invariants: raw prompt/transcript payloads are not modeled for display.
 */

export type RangeDays = 7 | 30 | 90;
export type DurationCapValue = "2h" | "4h" | "8h" | "none";
export type RawStatusFilter = "all" | "completed" | "filtered" | "in_progress" | "unmatched";
export type RawSourceFilter = "all" | "explicit_end" | "next_start_recovery" | "duration_cap" | "diagnostic";

export type TelemetryBreakdown = {
  key: string;
  displayName: string;
  agentHours: number;
  completedTurnCount: number;
  inProgressTurnCount: number;
  unmatchedTurnCount: number;
  lastSeenAt: number | null;
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

export type RuntimeTurn = {
  id: string;
  projectName: string | null;
  projectId: string | null;
  teamId: string | null;
  turnId: string;
  agentName: string | null;
  startedAt: number | null;
  endedAt: number | null;
  durationMs: number | null;
  status: "completed" | "in_progress" | "unmatched" | "filtered";
  completionSource: "explicit_end" | "next_start_recovery" | null;
  filteredReason: "duration_cap" | null;
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
  dailyBuckets: Array<{
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
  }>;
  hourlyBuckets: TelemetryHourBucket[];
  parallelCapacity: {
    today: ParallelCapacityDayBucket;
    dailyBuckets: ParallelCapacityDayBucket[];
    maxConcurrentSessions30d: number;
    maxConcurrentProjects30d: number;
  };
  recentTurns: RuntimeTurn[];
  turnsPage: {
    rows: RuntimeTurn[];
    page: number;
    pageSize: number;
    total: number;
    pageCount: number;
  };
};
