import { describe, expect, it } from "vitest";
import {
  OFFICE_SKILL_FLOW_FRESHNESS_MS,
  type OfficeSkillFlowFurniture,
  projectObservedSkillFlows,
} from "./observed-skill-flow-projection";

const now = 1_720_000_000_000;
const furniture: OfficeSkillFlowFurniture[] = [
  {
    id: "workstation:x-thread",
    skillId: "x-thread",
    kind: "workstation",
    departmentId: "marketing",
    position: [1, 0, 2],
  },
  {
    id: "system-facility:x-publishing",
    skillId: "x-account",
    kind: "system-facility",
    departmentId: "marketing",
    position: [3, 0, 4],
  },
];

function event(
  input: Partial<{ sessionId: string; skillId: string; occurredAt: number; _id: string }> = {},
) {
  return {
    _id: input._id,
    sessionId: input.sessionId ?? "session-a",
    skillId: input.skillId ?? "x-thread",
    skillPath: "/skills/x-thread/SKILL.md",
    sourceTool: "codex",
    sourceEvent: "PostToolUse",
    label: "x-thread",
    occurredAt: input.occurredAt ?? now - 1_000,
    source: "hook",
    receivedAt: now,
  };
}

describe("observed skill flow projection", () => {
  it("shows a fresh known call without predicting a next facility", () => {
    expect(projectObservedSkillFlows({ events: [event()], furniture, now })).toEqual([
      expect.objectContaining({
        sessionId: "session-a",
        current: expect.objectContaining({ id: "workstation:x-thread" }),
        previous: undefined,
      }),
    ]);
  });

  it("links only the observed immediate predecessor in the same session", () => {
    const flows = projectObservedSkillFlows({
      events: [
        event({ _id: "thread", skillId: "x-thread", occurredAt: now - 4_000 }),
        event({ _id: "publish", skillId: "x-account", occurredAt: now - 1_000 }),
      ],
      furniture,
      now,
    });

    expect(flows).toEqual([
      expect.objectContaining({
        current: expect.objectContaining({ id: "system-facility:x-publishing" }),
        previous: expect.objectContaining({ id: "workstation:x-thread" }),
      }),
    ]);
  });

  it("rejects stale, unknown, future, and sessionless events", () => {
    const flows = projectObservedSkillFlows({
      events: [
        event({ _id: "stale", occurredAt: now - OFFICE_SKILL_FLOW_FRESHNESS_MS }),
        event({ _id: "unknown", skillId: "not-on-the-map" }),
        event({ _id: "future", occurredAt: now + 1 }),
        event({ _id: "no-session", sessionId: "" }),
      ],
      furniture,
      now,
    });

    expect(flows).toEqual([]);
  });

  it("keeps two sessions independent and selects the newest fresh event for each", () => {
    const flows = projectObservedSkillFlows({
      events: [
        event({ _id: "a-thread", occurredAt: now - 4_000 }),
        event({ _id: "a-publish", skillId: "x-account", occurredAt: now - 1_000 }),
        event({ _id: "b-thread", sessionId: "session-b", occurredAt: now - 2_000 }),
      ],
      furniture,
      now,
    });

    expect(flows.map((flow) => [flow.sessionId, flow.current.skillId])).toEqual([
      ["session-a", "x-account"],
      ["session-b", "x-thread"],
    ]);
  });
});
