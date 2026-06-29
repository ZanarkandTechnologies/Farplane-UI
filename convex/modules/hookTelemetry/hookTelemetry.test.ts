import { describe, expect, it } from "vitest";
import { hookTelemetryRowsToLearningTimelineRows } from "./learningTimeline";
import { isFarplaneFileEventPayload } from "./farplaneFileEvents";
import {
  type HookTelemetryRow,
  hookTelemetryRowsToActivityPingRows,
  hookTelemetryRowsToAgentBubbleMessages,
  hookTelemetryRowsToObservedCodexWorkers,
  hookTelemetryRowsToOfficeTravelIntents,
  hookTelemetryRowsToSkillInvocationRows,
  hookTelemetryRowsToThreadLineageGraph,
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

  it("projects Codex event miner rows into a learning timeline", () => {
    const rows = hookTelemetryRowsToLearningTimelineRows([
      {
        hookName: "codex-event-miner",
        hookType: "Stop",
        projectId: "codex-proj-farplane-ui",
        sessionId: "session-1",
        eventAt: 2_000,
        eventKey: "decision-key",
        payload: {
          eventName: "decision.observed",
          ticketId: "TASK-0019",
          threadId: "session-1",
          turnId: "turn-2",
          source: "stop_payload",
          sourceProgram: "decision-v1",
          status: "accepted",
          summary: "Use codex-event-miner as the Stop hook abstraction.",
          decisionKind: "architecture",
          prompt: "should not leak",
        },
      },
      {
        hookName: "codex-event-miner",
        hookType: "Stop",
        projectId: "codex-proj-farplane-ui",
        sessionId: "session-1",
        eventAt: 1_000,
        eventKey: "lesson-key",
        payload: {
          eventName: "learning.lesson.observed",
          ticketId: "TASK-0019",
          source: "learning_review_report",
          sourceProgram: "learning-docs-v1",
          status: "observed",
          severity: "low",
          summary: "Prefer event projections over raw self event logs.",
          docsDelta: { target: "docs/LESSONS.md", rowsAdded: 1 },
          transcript: "should not leak",
        },
      },
    ]);

    expect(rows).toEqual([
      expect.objectContaining({
        id: "decision-key",
        eventName: "decision.observed",
        ticketId: "TASK-0019",
        sourceProgram: "decision-v1",
        decisionKind: "architecture",
        eventAt: 2_000,
      }),
      expect.objectContaining({
        id: "lesson-key",
        eventName: "learning.lesson.observed",
        docsTarget: "docs/LESSONS.md",
        rowsAdded: 1,
        eventAt: 1_000,
      }),
    ]);
    expect(JSON.stringify(rows)).not.toContain("should not leak");
  });

  it("projects typed Farplane file events into the learning timeline", () => {
    const validFarplanePayload = {
      schemaVersion: 1,
      eventName: "farplane.ticket.completed",
      source: "local_file_post_tool_use",
      threadId: "thread-1",
      path: "tickets/TASK-0099/ticket.md",
      entityKind: "ticket",
      entityId: "TASK-0099",
      contentHash: "hash-1",
      terminal: true,
      summary: "ticket TASK-0099 changed",
      eventAt: 3_000,
      eventKey: "ticket-completed-key",
      changedFields: [
        { path: "status", before: { hash: "hash-review", preview: "review" }, after: { hash: "hash-done", preview: "done" } },
        { path: "next_action", before: { hash: "hash-proof", preview: "finish proof" }, after: { hash: "hash-done", preview: "done" } },
      ],
      body: "should not leak",
    } as const;
    expect(isFarplaneFileEventPayload(validFarplanePayload)).toBe(true);
    expect(isFarplaneFileEventPayload({ ...validFarplanePayload, eventName: "farplane.ticket.nope" })).toBe(false);

    const rows = hookTelemetryRowsToLearningTimelineRows([
      {
        hookName: "file-change-listener",
        hookType: "PostToolUse",
        projectId: "codex-proj-farplane-ui",
        sessionId: "thread-1",
        eventAt: 3_000,
        eventKey: "ticket-completed-key",
        payload: validFarplanePayload,
      },
      {
        hookName: "file-change-listener",
        hookType: "PostToolUse",
        eventAt: 2_000,
        eventKey: "provider-key",
        payload: {
          schemaVersion: 1,
          eventName: "farplane.bindings.changed",
          source: "provider_webhook",
          provider: "linear",
          externalId: "LIN-1",
          entityKind: "binding",
          entityId: "kanban",
          summary: "binding changed",
          changedFields: [{ path: "kanban.provider", after: { preview: "linear" } }],
          rawFile: "should not leak",
        },
      },
    ]);

    expect(rows).toEqual([
      expect.objectContaining({
        id: "ticket-completed-key",
        eventName: "farplane.ticket.completed",
        entityKind: "ticket",
        entityId: "TASK-0099",
        filePath: "tickets/TASK-0099/ticket.md",
        changedFields: ["status", "next_action"],
        eventAt: 3_000,
      }),
      expect.objectContaining({
        id: "provider-key",
        eventName: "farplane.bindings.changed",
        entityKind: "binding",
        entityId: "kanban",
        changedFields: ["kanban.provider"],
        eventAt: 2_000,
      }),
    ]);
    expect(JSON.stringify(rows)).not.toContain("should not leak");
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

  it("does not project Codex event miner bookkeeping rows as runtime pings", () => {
    const rows: HookTelemetryRow[] = [
      {
        hookName: "codex-event-miner",
        hookType: "Stop",
        projectId: "codex-proj-farplane-ui",
        sessionId: "thread-1",
        eventAt: 2_000,
        eventKey: "miner-window",
        payload: {
          schemaVersion: 1,
          eventName: "miner.window.updated",
          threadId: "thread-1",
          turnId: "turn-1",
          cwd: "/work/farplane",
          source: "stop_payload",
          sourceProgram: "codex-event-miner",
          status: "updated",
          summary: "Captured Stop turn 1; miner cadence is 5.",
          turnCount: 1,
          cadenceTurns: 5,
          nextReviewInTurns: 4,
        },
      },
      {
        hookName: "codex-event-miner",
        hookType: "Stop",
        projectId: "codex-proj-farplane-ui",
        sessionId: "thread-1",
        eventAt: 2_000,
        eventKey: "miner-skipped",
        payload: {
          schemaVersion: 1,
          eventName: "miner.agent.skipped",
          threadId: "thread-1",
          turnId: "turn-1",
          cwd: "/work/farplane",
          source: "window_cadence",
          sourceProgram: "codex-event-miner",
          status: "not_due",
          summary: "Learning review not due; 4 turns remaining.",
          turnCount: 1,
          cadenceTurns: 5,
          nextReviewInTurns: 4,
        },
      },
    ];

    expect(hookTelemetryRowsToActivityPingRows(rows)).toEqual([]);
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
        currentSkillId: "goal-advisor",
        controllable: false,
      }),
    );
    expect(JSON.stringify(workers)).not.toContain("should not leak");
  });

  it("preserves observed worker parent lineage across newer rows", () => {
    const workers = hookTelemetryRowsToObservedCodexWorkers([
      {
        hookName: "codex-runtime",
        hookType: "UserPromptSubmit",
        projectId: "codex-proj-farplane",
        sessionId: "child-thread",
        eventAt: 1_000,
        payload: {
          machineId: "machine-a",
          threadId: "child-thread",
          parentThreadId: "parent-thread",
          cwd: "/work/farplane",
        },
      },
      {
        hookName: "codex-runtime",
        hookType: "Stop",
        projectId: "codex-proj-farplane",
        sessionId: "child-thread",
        eventAt: 2_000,
        payload: {
          machineId: "machine-a",
          threadId: "child-thread",
          cwd: "/work/farplane",
        },
      },
    ]);

    expect(workers).toEqual([
      expect.objectContaining({
        workerId: "codex-observed:machine-a:codex-proj-farplane:child-thread",
        parentThreadId: "parent-thread",
        state: "done",
      }),
    ]);
  });

  it("keeps sessions with a latest start hook and no later stop hook running", () => {
    const workers = hookTelemetryRowsToObservedCodexWorkers([
      {
        hookName: "codex-runtime",
        hookType: "Heartbeat",
        projectId: "codex-proj-farplane",
        sessionId: "thread-open",
        eventAt: 3_000,
        payload: {
          machineId: "machine-a",
          threadId: "thread-open",
          cwd: "/work/farplane",
        },
      },
      {
        hookName: "codex-runtime",
        hookType: "TurnStart",
        projectId: "codex-proj-farplane",
        sessionId: "thread-open",
        eventAt: 2_000,
        payload: {
          machineId: "machine-a",
          threadId: "thread-open",
          cwd: "/work/farplane",
        },
      },
      {
        hookName: "codex-runtime",
        hookType: "Stop",
        projectId: "codex-proj-farplane",
        sessionId: "thread-closed",
        eventAt: 5_000,
        payload: {
          machineId: "machine-a",
          threadId: "thread-closed",
          cwd: "/work/farplane",
        },
      },
      {
        hookName: "codex-runtime",
        hookType: "TurnStart",
        projectId: "codex-proj-farplane",
        sessionId: "thread-closed",
        eventAt: 4_000,
        payload: {
          machineId: "machine-a",
          threadId: "thread-closed",
          cwd: "/work/farplane",
        },
      },
    ]);

    expect(workers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          workerId: "codex-observed:machine-a:codex-proj-farplane:thread-open",
          state: "running",
          statusText: "Codex turn running",
        }),
        expect.objectContaining({
          workerId: "codex-observed:machine-a:codex-proj-farplane:thread-closed",
          state: "done",
        }),
      ]),
    );
  });

  it("projects subagent lifecycle hooks into ephemeral observed workers", () => {
    const workers = hookTelemetryRowsToObservedCodexWorkers([
      {
        hookName: "codex-runtime",
        hookType: "SubagentStart",
        projectId: "codex-proj-farplane",
        sessionId: "subagent-thread",
        eventAt: 1_000,
        payload: {
          machineId: "machine-a",
          threadId: "subagent-thread",
          cwd: "/work/farplane",
          title: "Review lane",
        },
      },
      {
        hookName: "codex-runtime",
        hookType: "SubagentStop",
        projectId: "codex-proj-farplane",
        sessionId: "subagent-thread",
        eventAt: 2_000,
        payload: {
          machineId: "machine-a",
          threadId: "subagent-thread",
          cwd: "/work/farplane",
        },
      },
    ]);

    expect(workers).toEqual([
      expect.objectContaining({
        workerId: "codex-observed:machine-a:codex-proj-farplane:subagent-thread",
        displayName: "Review lane",
        state: "done",
        isEphemeral: true,
        controllable: false,
      }),
    ]);
  });

  it("projects file change summaries into observed Codex workers from cwd", () => {
    const workers = hookTelemetryRowsToObservedCodexWorkers([
      {
        hookName: "file-change-listener",
        hookType: "PostToolUse",
        sessionId: "thread-3",
        eventAt: 4_000,
        payload: {
          eventName: "file.change.summary",
          threadId: "thread-3",
          cwd: "/Users/kenji/Farplane UI",
          message: "Updated progress with summary-only hook proof.",
        },
      },
    ]);

    expect(workers).toEqual([
      expect.objectContaining({
        workerId: "codex-observed:file-change-listener:codex-proj-users-kenji-farplane-ui:thread-3",
        sourceInstanceId: "file-change-listener",
        projectId: "codex-proj-users-kenji-farplane-ui",
        projectPath: "/Users/kenji/Farplane UI",
        sessionKey: "thread-3",
        threadId: "thread-3",
        statusText: "Updated progress with summary-only hook proof.",
      }),
    ]);
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
      {
        threadId: "thread-1",
        message: "Updated progress with summary-only hook proof.",
        eventAt: 4_000,
      },
    ]);
  });

  it("projects thread lineage rows into graph nodes and edges", () => {
    const graph = hookTelemetryRowsToThreadLineageGraph([
      {
        hookName: "thread-lineage-listener",
        hookType: "PostToolUse",
        sessionId: "parent-thread",
        eventAt: 5_000,
        eventKey: "edge-create",
        payload: {
          eventName: "thread.created",
          toolName: "create_thread",
          parentThreadId: "parent-thread",
          childThreadId: "child-thread",
          title: "Child implementation",
          cwd: "/repo",
        },
      },
      {
        hookName: "thread-lineage-listener",
        hookType: "PostToolUse",
        sessionId: "parent-thread",
        eventAt: 6_000,
        eventKey: "edge-fork",
        payload: {
          eventName: "thread.forked",
          toolName: "fork_thread",
          parentThreadId: "parent-thread",
          pendingWorktreeId: "pending-1",
          cwd: "/repo",
        },
      },
    ]);

    expect(graph.stats).toEqual({
      nodeCount: 3,
      edgeCount: 2,
      forkCount: 1,
      createCount: 1,
      orphanCount: 0,
    });
    expect(graph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "parent-thread", kind: "thread" }),
        expect.objectContaining({
          id: "child-thread",
          label: "Child implementation",
          kind: "thread",
        }),
        expect.objectContaining({ id: "pending:pending-1", kind: "pending" }),
      ]),
    );
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "edge-create",
          source: "parent-thread",
          target: "child-thread",
          kind: "created",
        }),
        expect.objectContaining({
          id: "edge-fork",
          source: "parent-thread",
          target: "pending:pending-1",
          kind: "forked",
        }),
      ]),
    );
  });

  it("projects thread lineage backfill rows into the same graph", () => {
    const graph = hookTelemetryRowsToThreadLineageGraph([
      {
        hookName: "thread-lineage-backfill",
        hookType: "Backfill",
        sessionId: "parent-thread",
        projectId: "codex-proj-repo",
        eventAt: 7_000,
        eventKey: "thread-lineage:v1:codex-proj-repo:parent-thread:child-thread:forked",
        payload: {
          eventName: "thread.forked",
          sourceTool: "backfill",
          parentThreadId: "parent-thread",
          childThreadId: "child-thread",
          title: "Manual fork",
          cwd: "/repo",
        },
      },
    ]);

    expect(graph.stats).toEqual({
      nodeCount: 2,
      edgeCount: 1,
      forkCount: 1,
      createCount: 0,
      orphanCount: 0,
    });
    expect(graph.edges).toEqual([
      expect.objectContaining({
        id: "thread-lineage:v1:codex-proj-repo:parent-thread:child-thread:forked",
        source: "parent-thread",
        target: "child-thread",
        kind: "forked",
        sourceTool: "backfill",
        title: "Manual fork",
      }),
    ]);
  });
});
