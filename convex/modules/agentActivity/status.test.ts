import { describe, expect, it } from "vitest";
import { activityOutcome, toActivityFeedEvent } from "./status";

describe("agent activity status projections", () => {
  it("projects retained activity from agent events only", () => {
    expect(
      toActivityFeedEvent({
        _id: "event-1",
        projectId: "proj-alpha",
        agentId: "researcher",
        eventType: "activity_log",
        activityType: "research",
        label: "Researching",
        occurredAt: 123,
      }),
    ).toEqual({
      id: "event-1",
      sourceType: "agent_event",
      projectId: "proj-alpha",
      agentId: "researcher",
      eventType: "activity_log",
      activityType: "research",
      label: "Researching",
      occurredAt: 123,
      beatId: undefined,
      sessionKey: undefined,
      detail: undefined,
      taskId: undefined,
    });
  });

  it("derives beat outcomes without task lifecycle events", () => {
    expect(activityOutcome({ eventType: "heartbeat_error" })).toBe("error");
    expect(activityOutcome({ eventType: "activity_log", activityType: "blocked" })).toBe("blocked");
    expect(activityOutcome({ eventType: "heartbeat_end" })).toBe("done");
    expect(activityOutcome({ eventType: "activity_log", activityType: "summary" })).toBe("done");
    expect(activityOutcome({ eventType: "tool_call" })).toBe("in_progress");
  });
});
