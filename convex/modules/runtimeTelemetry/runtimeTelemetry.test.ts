import { describe, expect, it } from "vitest";

import { buildRuntimeTurns, buildTelemetrySummary, type ActivityPingRow } from "./runtimeTelemetry";

const base = {
  source: "test",
  activeAgentCount: 1,
  projectName: "Farplane",
  projectId: "proj-farplane",
  teamId: "team-proj-farplane",
  sessionId: "session-1",
  agentName: "codex",
} satisfies Partial<ActivityPingRow>;

function row(
  input: Partial<ActivityPingRow> & Pick<ActivityPingRow, "eventType" | "receivedAt" | "turnId">,
): ActivityPingRow {
  return {
    ...base,
    ...input,
    source: input.source ?? base.source ?? "test",
    activeAgentCount: input.activeAgentCount ?? base.activeAgentCount ?? 1,
  };
}

describe("runtime telemetry reducers", () => {
  it("counts only matched turn starts and stops as completed hours", () => {
    const rows = [
      row({ eventType: "turn_start", turnId: "turn-1", receivedAt: 1_000 }),
      row({ eventType: "turn_end", turnId: "turn-1", receivedAt: 3_601_000 }),
      row({ eventType: "turn_start", turnId: "turn-2", receivedAt: 3_700_000 }),
      row({ eventType: "turn_end", turnId: "turn-3", receivedAt: 3_800_000 }),
    ];

    const turns = buildRuntimeTurns(rows);
    const summary = buildTelemetrySummary(rows, {
      now: 4_000_000,
      days: 1,
      timezone: "UTC",
    });

    expect(turns.map((turn) => turn.status).sort()).toEqual([
      "completed",
      "in_progress",
      "unmatched",
    ]);
    expect(summary.stats.completedTurnCount).toBe(1);
    expect(summary.stats.inProgressTurnCount).toBe(1);
    expect(summary.stats.unmatchedTurnCount).toBe(1);
    expect(summary.stats.agentHours).toBeCloseTo(1);
  });

  it("infers a missed turn end from the next start in the same session", () => {
    const rows = [
      row({ eventType: "turn_start", turnId: "turn-1", receivedAt: 1_000 }),
      row({ eventType: "turn_start", turnId: "turn-2", receivedAt: 1_801_000 }),
    ];

    const turns = buildRuntimeTurns(rows);
    const summary = buildTelemetrySummary(rows, {
      now: 2_000_000,
      days: 1,
      timezone: "UTC",
    });

    expect(turns).toEqual([
      expect.objectContaining({ turnId: "turn-1" }),
      expect.objectContaining({ turnId: "turn-2" }),
    ]);
    expect(turns.find((turn) => turn.turnId === "turn-1")).toEqual(
      expect.objectContaining({
        status: "completed",
        startedAt: 1_000,
        endedAt: 1_801_000,
        durationMs: 1_800_000,
      }),
    );
    expect(turns.find((turn) => turn.turnId === "turn-2")).toEqual(
      expect.objectContaining({
        status: "in_progress",
        startedAt: 1_801_000,
        endedAt: null,
      }),
    );
    expect(summary.stats.completedTurnCount).toBe(1);
    expect(summary.stats.inProgressTurnCount).toBe(1);
    expect(summary.stats.agentHours).toBeCloseTo(0.5);
  });

  it("filters suspicious long inferred turns from counted hours", () => {
    const rows = [
      row({ eventType: "turn_start", turnId: "turn-1", receivedAt: 1_000 }),
      row({ eventType: "turn_start", turnId: "turn-2", receivedAt: 10 * 60 * 60 * 1000 + 1_000 }),
    ];

    const summary = buildTelemetrySummary(rows, {
      now: 11 * 60 * 60 * 1000,
      days: 1,
      timezone: "UTC",
    });

    expect(summary.stats.completedTurnCount).toBe(0);
    expect(summary.stats.filteredTurnCount).toBe(1);
    expect(summary.stats.filteredAgentHours).toBeCloseTo(10);
    expect(summary.stats.agentHours).toBe(0);
    expect(summary.turnsPage.rows.find((turn) => turn.turnId === "turn-1")).toEqual(
      expect.objectContaining({
        completionSource: "next_start_recovery",
        filteredReason: "duration_cap",
        status: "filtered",
      }),
    );
  });

  it("returns a paged turn slice", () => {
    const rows = Array.from({ length: 6 }, (_, index) => {
      const turnNumber = index + 1;
      const startedAt = turnNumber * 100_000;
      return [
        row({ eventType: "turn_start", turnId: `turn-${turnNumber}`, receivedAt: startedAt }),
        row({ eventType: "turn_end", turnId: `turn-${turnNumber}`, receivedAt: startedAt + 60_000 }),
      ];
    }).flat();

    const summary = buildTelemetrySummary(rows, {
      now: 1_000_000,
      days: 1,
      timezone: "UTC",
      turnPage: 2,
      turnPageSize: 2,
    });

    expect(summary.turnsPage).toEqual(
      expect.objectContaining({
        page: 2,
        pageCount: 3,
        pageSize: 2,
        total: 6,
      }),
    );
    expect(summary.turnsPage.rows.map((turn) => turn.turnId)).toEqual(["turn-4", "turn-3"]);
  });

  it("derives hourly source-map, capacity, longest-turn, and availability fields", () => {
    const now = Date.UTC(2026, 0, 2, 12, 30);
    const start = Date.UTC(2026, 0, 2, 9, 0);
    const end = Date.UTC(2026, 0, 2, 10, 30);
    const rows = [
      row({ eventType: "turn_start", turnId: "turn-1", receivedAt: start }),
      row({ eventType: "turn_end", turnId: "turn-1", receivedAt: end }),
    ];

    const summary = buildTelemetrySummary(rows, {
      now,
      days: 2,
      timezone: "UTC",
    });
    const today = summary.dailyBuckets[summary.dailyBuckets.length - 1];
    const stopHour = summary.hourlyBuckets.find((bucket) => bucket.hourKey === String(Date.UTC(2026, 0, 2, 10, 0)));

    expect(summary.agentHourSummary.todayHours).toBeCloseTo(1.5);
    expect(today).toEqual(
      expect.objectContaining({
        availabilityPercent: 8,
        completedTurnCount: 1,
        coveredHours: 2,
        longestTurnDurationMs: 90 * 60 * 1000,
        machineCount: 1,
        projectCount: 1,
      }),
    );
    expect(stopHour).toEqual(
      expect.objectContaining({
        agentHours: 1.5,
        completedTurnCount: 1,
        topProjectDisplayName: "Farplane",
      }),
    );
  });

  it("derives parallel capacity from capped completed intervals only", () => {
    const now = Date.UTC(2026, 0, 2, 23, 0);
    const firstStart = Date.UTC(2026, 0, 2, 9, 0);
    const secondStart = Date.UTC(2026, 0, 2, 9, 30);
    const rows = [
      row({
        eventType: "turn_start",
        turnId: "turn-1",
        receivedAt: firstStart,
        projectName: "Farplane",
        projectId: "project-1",
        sessionId: "session-1",
      }),
      row({
        eventType: "turn_end",
        turnId: "turn-1",
        receivedAt: Date.UTC(2026, 0, 2, 11, 0),
        projectName: "Farplane",
        projectId: "project-1",
        sessionId: "session-1",
      }),
      row({
        eventType: "turn_start",
        turnId: "turn-2",
        receivedAt: secondStart,
        projectName: "Valefor",
        projectId: "project-2",
        sessionId: "session-2",
      }),
      row({
        eventType: "turn_end",
        turnId: "turn-2",
        receivedAt: Date.UTC(2026, 0, 2, 10, 15),
        projectName: "Valefor",
        projectId: "project-2",
        sessionId: "session-2",
      }),
      row({
        eventType: "turn_start",
        turnId: "too-long",
        receivedAt: Date.UTC(2026, 0, 2, 1, 0),
        projectName: "Filtered",
        projectId: "project-3",
        sessionId: "session-3",
      }),
      row({
        eventType: "turn_end",
        turnId: "too-long",
        receivedAt: Date.UTC(2026, 0, 2, 8, 0),
        projectName: "Filtered",
        projectId: "project-3",
        sessionId: "session-3",
      }),
    ];

    const summary = buildTelemetrySummary(rows, {
      maxTurnDurationMs: 4 * 60 * 60 * 1000,
      now,
      days: 1,
      timezone: "UTC",
    });

    expect(summary.stats.filteredTurnCount).toBe(1);
    expect(summary.parallelCapacity.today).toEqual(
      expect.objectContaining({
        peakConcurrentProjects: 2,
        peakConcurrentSessions: 2,
      }),
    );
    expect(summary.parallelCapacity.today.peakProjects.map((project) => project.displayName).sort()).toEqual([
      "Farplane",
      "Valefor",
    ]);
  });

  it("does not infer missed turn ends across different sessions", () => {
    const rows = [
      row({ eventType: "turn_start", turnId: "turn-1", receivedAt: 1_000, sessionId: "session-1" }),
      row({
        eventType: "turn_start",
        turnId: "turn-2",
        receivedAt: 1_801_000,
        sessionId: "session-2",
      }),
    ];

    const turns = buildRuntimeTurns(rows);

    expect(turns.map((turn) => turn.status)).toEqual(["in_progress", "in_progress"]);
  });

  it("keeps team and project totals aligned for a single-team fixture", () => {
    const rows = [
      row({ eventType: "turn_start", turnId: "turn-1", receivedAt: 1_000 }),
      row({ eventType: "turn_end", turnId: "turn-1", receivedAt: 1_801_000 }),
    ];
    const summary = buildTelemetrySummary(rows, {
      now: 2_000_000,
      days: 1,
      timezone: "UTC",
    });

    expect(summary.projectBreakdown).toHaveLength(1);
    expect(summary.teamBreakdown).toHaveLength(1);
    expect(summary.projectBreakdown[0]?.agentHours).toBeCloseTo(0.5);
    expect(summary.teamBreakdown[0]?.agentHours).toBeCloseTo(summary.stats.agentHours);
  });

  it("falls back to project and derived team identity when explicit ids are missing", () => {
    const rows = [
      row({
        eventType: "turn_start",
        turnId: "turn-1",
        receivedAt: 1_000,
        projectId: undefined,
        teamId: undefined,
        projectDirectory: "/Users/test/Farplane-UI",
      }),
      row({
        eventType: "turn_end",
        turnId: "turn-1",
        receivedAt: 61_000,
        projectId: undefined,
        teamId: undefined,
        projectDirectory: "/Users/test/Farplane-UI",
      }),
    ];
    const summary = buildTelemetrySummary(rows, {
      now: 100_000,
      days: 1,
      timezone: "UTC",
    });

    expect(summary.projectBreakdown[0]?.displayName).toBe("Farplane");
    expect(summary.teamBreakdown[0]?.displayName).toBe("Unlabeled team");
  });
});
