import { describe, expect, it } from "vitest";
import {
  hookTelemetryRowsToAgentBubbleMessages,
  hookTelemetryRowsToActivityPingRows,
  hookTelemetryRowsToObservedCodexWorkers,
  hookTelemetryRowsToOfficeTravelIntents,
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

  it("separates observed Codex workers by machine, project, and thread identity", () => {
    const rows: HookTelemetryRow[] = [
      {
        hookName: "codex-runtime",
        hookType: "TurnStart",
        projectId: "codex-proj-farplane",
        sessionId: "thread-1",
        eventAt: 1_000,
        payload: {
          machineId: "machine-a",
          machineName: "Studio Mac",
          threadId: "thread-1",
          turnId: "turn-1",
          cwd: "/work/farplane",
          title: "Build presence",
        },
      },
      {
        hookName: "codex-runtime",
        hookType: "PostToolUse",
        projectId: "codex-proj-farplane",
        sessionId: "thread-1",
        eventAt: 2_000,
        payload: {
          machineId: "machine-a",
          machineName: "Studio Mac",
          threadId: "thread-1",
          skillId: "goal-advisor",
          prompt: "should not leak",
        },
      },
      {
        hookName: "codex-runtime",
        hookType: "TurnStart",
        projectId: "codex-proj-farplane",
        sessionId: "thread-2",
        eventAt: 3_000,
        payload: {
          machineId: "machine-b",
          machineName: "Laptop",
          threadId: "thread-2",
          turnId: "turn-2",
          cwd: "/work/farplane",
        },
      },
    ];

    const workers = hookTelemetryRowsToObservedCodexWorkers(rows);

    expect(workers).toHaveLength(2);
    expect(workers.map((worker) => worker.workerId).sort()).toEqual([
      "codex-observed:machine-a:codex-proj-farplane:thread-1",
      "codex-observed:machine-b:codex-proj-farplane:thread-2",
    ]);
    expect(workers.find((worker) => worker.workerId.includes("machine-a"))).toEqual(
      expect.objectContaining({
        sourceInstanceId: "machine-a",
        projectId: "codex-proj-farplane",
        sessionKey: "thread-1",
        state: "running",
        statusText: "Calling goal advisor",
        controllable: false,
      }),
    );
    expect(JSON.stringify(workers)).not.toContain("should not leak");
  });

  it("projects skill invocation rows into bubble messages and office travel intents", () => {
    const rows: HookTelemetryRow[] = [
      {
        hookName: "skill-invocation-listener",
        hookType: "PostToolUse",
        sessionId: "thread-1",
        eventAt: 3_000,
        payload: {
          skillId: "openai-docs",
          skillPath: "/skills/openai-docs/SKILL.md",
        },
      },
    ];

    expect(hookTelemetryRowsToAgentBubbleMessages(rows)).toEqual([
      { threadId: "thread-1", message: "Calling openai docs", eventAt: 3_000 },
    ]);
    expect(hookTelemetryRowsToOfficeTravelIntents(rows)).toEqual([
      { threadId: "thread-1", target: { kind: "skill", id: "openai-docs" }, eventAt: 3_000 },
    ]);
  });

  it("projects file change summaries into bubble messages", () => {
    const rows: HookTelemetryRow[] = [
      {
        hookName: "file-change-listener",
        hookType: "PostToolUse",
        sessionId: "thread-1",
        eventAt: 4_000,
        payload: {
          eventName: "file.change.summary",
          threadId: "thread-1",
          message: "Updated progress with summary-only hook proof.",
        },
      },
    ];

    expect(hookTelemetryRowsToAgentBubbleMessages(rows)).toEqual([
      { threadId: "thread-1", message: "Updated progress with summary-only hook proof.", eventAt: 4_000 },
    ]);
  });
});
