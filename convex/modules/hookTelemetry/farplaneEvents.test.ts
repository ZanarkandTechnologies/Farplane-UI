import { describe, expect, it } from "vitest";
import { normalizeFarplaneEvent, normalizeFarplaneEvents } from "./farplaneEvents";
import {
  type HookTelemetryRow,
  hookTelemetryRowsToAgentBubbleMessages,
  hookTelemetryRowsToObservedCodexWorkers,
} from "./projections";

function ping(hookType: string, payload: Record<string, unknown>, eventAt = 1_000): HookTelemetryRow {
  return {
    hookName: "farplane-console-ping",
    hookType,
    projectId: "codex-proj-farplane",
    sessionId: "session-1",
    eventAt,
    eventKey: `key-${hookType}-${eventAt}`,
    payload: { projectDirectory: "/work/farplane", threadId: "session-1", ...payload },
  };
}

describe("normalizeFarplaneEvent", () => {
  it("maps lifecycle pings to turn and subagent events with runtime", () => {
    expect(normalizeFarplaneEvent(ping("UserPromptSubmit", { runtime: "claude" }))).toMatchObject({
      v: 1,
      kind: "turn.started",
      runtime: "claude",
      project: { id: "codex-proj-farplane", path: "/work/farplane" },
      actor: { sessionId: "session-1", threadId: "session-1" },
    });
    expect(normalizeFarplaneEvent(ping("Stop", {}))?.kind).toBe("turn.ended");
    expect(
      normalizeFarplaneEvent(
        ping("SubagentStart", { agentId: "agent-7", parentThreadId: "session-1", agentType: "Explore" }),
      ),
    ).toMatchObject({
      kind: "subagent.started",
      actor: { threadId: "agent-7", parentThreadId: "session-1", agentType: "Explore" },
    });
  });

  it("infers runtime from the source prefix on rows sent before the runtime field", () => {
    expect(normalizeFarplaneEvent(ping("Stop", { source: "claude-stop" }))?.runtime).toBe("claude");
    expect(normalizeFarplaneEvent(ping("Stop", { source: "codex-stop" }))?.runtime).toBe("codex");
    expect(normalizeFarplaneEvent(ping("Stop", {}))?.runtime).toBe("codex");
  });

  it("maps gate blocks and rejects unknown gates", () => {
    expect(normalizeFarplaneEvent(ping("GateBlocked", { gate: "response-length" }))).toMatchObject({
      kind: "gate.blocked",
      gate: "response-length",
    });
    expect(normalizeFarplaneEvent(ping("GateBlocked", { gate: "made-up" }))).toBeNull();
  });

  it("maps legacy skill, file, and lineage rows", () => {
    expect(
      normalizeFarplaneEvent({
        hookName: "skill-invocation-listener",
        hookType: "PostToolUse",
        projectId: "p",
        sessionId: "s",
        eventAt: 1,
        payload: { skillId: "goal-advisor" },
      }),
    ).toMatchObject({ kind: "skill.invoked", skill: "goal-advisor" });
    expect(
      normalizeFarplaneEvent({
        hookName: "file-change-listener",
        hookType: "PostToolUse",
        projectId: "p",
        sessionId: "s",
        eventAt: 1,
        payload: { eventName: "file.change.summary", fileCount: 3 },
      }),
    ).toMatchObject({ kind: "files.changed", count: 3 });
    expect(
      normalizeFarplaneEvent({
        hookName: "thread-lineage-listener",
        hookType: "PostToolUse",
        projectId: "p",
        sessionId: "child",
        eventAt: 1,
        payload: { eventName: "thread.forked", parentThreadId: "parent" },
      }),
    ).toMatchObject({ kind: "thread.linked", link: "forked", parentThreadId: "parent" });
  });

  it("drops eval traffic, unknown hooks, and rows without identity", () => {
    expect(normalizeFarplaneEvent(ping("Stop", { runtimePurpose: "eval" }))).toBeNull();
    expect(normalizeFarplaneEvent(ping("Heartbeat", {}))).toBeNull();
    expect(normalizeFarplaneEvent({ ...ping("Stop", {}), sessionId: undefined, payload: {} })).toBeNull();
  });

  it("dedupes by id and sorts oldest first", () => {
    const rows = [ping("Stop", {}, 3_000), ping("UserPromptSubmit", {}, 1_000), ping("Stop", {}, 3_000)];
    expect(normalizeFarplaneEvents(rows).map((event) => [event.kind, event.at])).toEqual([
      ["turn.started", 1_000],
      ["turn.ended", 3_000],
    ]);
  });
});

describe("gate-aware projections", () => {
  it("keeps a bounced Claude turn running with the gate as status and bubble", () => {
    const rows = [
      ping("UserPromptSubmit", { runtime: "claude" }, 1_000),
      ping("Stop", { runtime: "claude" }, 2_000),
      ping("GateBlocked", { runtime: "claude", gate: "response-length" }, 2_001),
    ];
    const [worker] = hookTelemetryRowsToObservedCodexWorkers(rows);
    expect(worker).toMatchObject({
      runtime: "claude",
      state: "running",
      statusText: "Rewriting: response too long",
    });
    expect(hookTelemetryRowsToAgentBubbleMessages(rows)).toContainEqual({
      threadId: "session-1",
      message: "Rewriting: response too long",
      eventAt: 2_001,
    });
  });

  it("labels status text with the runtime", () => {
    const [worker] = hookTelemetryRowsToObservedCodexWorkers([ping("UserPromptSubmit", { runtime: "claude" })]);
    expect(worker.statusText).toBe("Claude turn running");
  });
});
