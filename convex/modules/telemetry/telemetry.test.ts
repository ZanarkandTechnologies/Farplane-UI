import { describe, expect, it } from "vitest";
import { generatedHookEventKey } from "./ingest";
import {
  hookEventToRow,
  legacyAgentEventRowToEvent,
  legacyHookRowToEvent,
  runtimeEventToRow,
} from "./rows";

describe("telemetry events rows", () => {
  it("round-trips an old hook row through events unchanged", () => {
    const old = {
      _id: "old-hook-1",
      hookName: "farplane-console-ping",
      hookType: "SubagentStart",
      projectId: "globex",
      sessionId: "session-1",
      payload: { turnId: "turn-1" },
      eventAt: 1_000,
      eventKey: "hook:key-1",
    };
    const event = legacyHookRowToEvent(old);
    expect(event).toMatchObject({ source: "hook", legacyId: "old-hook-1", eventKey: "hook:key-1" });
    expect(hookEventToRow({ ...event, _id: "new-1" })).toEqual({ ...old, _id: "new-1" });
  });

  it("maps runtime rows' source, sessionKey and occurredAt onto origin, sessionId and eventAt", () => {
    const old = {
      _id: "old-agent-1",
      teamId: "team-globex",
      projectId: "globex",
      agentId: "agent-a",
      eventType: "status_report",
      label: "executing",
      detail: "Writing the brief",
      state: "executing",
      source: "agent.self_report",
      stepKey: "step-1",
      sessionKey: "sess-9",
      beatId: "beat-1",
      occurredAt: 2_000,
    };
    const event = legacyAgentEventRowToEvent(old);
    expect(event).toMatchObject({
      source: "runtime",
      origin: "agent.self_report",
      sessionId: "sess-9",
      eventAt: 2_000,
      legacyId: "old-agent-1",
    });
    expect(runtimeEventToRow({ ...event, _id: "new-2" })).toEqual({ ...old, _id: "new-2" });
  });

  it("keeps the hook dedupe key stable for the same turn and second", () => {
    const base = { hookName: "skill-invocation-listener", hookType: "PostToolUse", sessionId: "s1", eventAt: 5_400 };
    const key = generatedHookEventKey({ ...base, payload: { turnId: "t1", toolUseId: "u1" } });
    expect(key).toBe("hook:skill-invocation-listener:PostToolUse:s1:t1:u1:5");
    expect(generatedHookEventKey({ ...base, eventAt: 5_999, payload: { turn_id: "t1", tool_use_id: "u1" } })).toBe(key);
  });
});
