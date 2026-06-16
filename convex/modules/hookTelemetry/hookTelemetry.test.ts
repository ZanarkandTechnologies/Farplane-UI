import { describe, expect, it } from "vitest";
import {
  hookTelemetryRowsToActivityPingRows,
  hookTelemetryRowsToSkillInvocationRows,
  type HookTelemetryRow,
} from "./projections";

describe("hook telemetry projections", () => {
  it("projects skill invocation rows from PostToolUse hook telemetry", () => {
    const rows = hookTelemetryRowsToSkillInvocationRows([
      {
        hookName: "skill-invocation-listener",
        hookType: "PostToolUse",
        sessionId: "session-1",
        eventAt: 1_000,
        eventKey: "key-1",
        payload: {
          turnId: "turn-1",
          toolName: "Read",
          skillId: "goal-advisor",
          skillPath: "/skills/goal-advisor/SKILL.md",
        },
      },
    ]);

    expect(rows).toEqual([
      expect.objectContaining({
        skillId: "goal-advisor",
        sourceTool: "Read",
        sourceEvent: "PostToolUse",
        sessionId: "session-1",
        turnId: "turn-1",
        occurredAt: 1_000,
      }),
    ]);
  });

  it("projects runtime pings from turn hook telemetry", () => {
    const rows: HookTelemetryRow[] = [
      {
        hookName: "codex-runtime",
        hookType: "TurnStart",
        projectId: "proj-farplane",
        sessionId: "session-1",
        eventAt: 1_000,
        payload: { turnId: "turn-1", projectName: "Farplane" },
      },
      {
        hookName: "codex-runtime",
        hookType: "Stop",
        projectId: "proj-farplane",
        sessionId: "session-1",
        eventAt: 2_000,
        payload: { turnId: "turn-1", projectName: "Farplane" },
      },
    ];

    expect(hookTelemetryRowsToActivityPingRows(rows)).toEqual([
      expect.objectContaining({
        eventType: "turn_start",
        projectId: "proj-farplane",
        teamId: "team-proj-farplane",
        turnId: "turn-1",
      }),
      expect.objectContaining({
        eventType: "turn_end",
        turnId: "turn-1",
      }),
    ]);
  });
});
