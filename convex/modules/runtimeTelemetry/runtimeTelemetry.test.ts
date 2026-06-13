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

function row(input: Partial<ActivityPingRow> & Pick<ActivityPingRow, "eventType" | "receivedAt" | "turnId">): ActivityPingRow {
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

    expect(turns.map((turn) => turn.status).sort()).toEqual(["completed", "in_progress", "unmatched"]);
    expect(summary.stats.completedTurnCount).toBe(1);
    expect(summary.stats.inProgressTurnCount).toBe(1);
    expect(summary.stats.unmatchedTurnCount).toBe(1);
    expect(summary.stats.agentHours).toBeCloseTo(1);
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
