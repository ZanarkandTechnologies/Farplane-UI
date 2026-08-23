import { describe, expect, it } from "vitest";
import type { EmployeeData } from "@/modules/office/lib/types";
import { resolveObservedSkillFlowEmployee } from "./observed-skill-flow-effects";

const employee = {
  _id: "employee-a",
  initialPosition: [0, 0, 0],
  observedRuntime: {
    kind: "codex",
    sourceInstanceId: "instance-a",
    sessionKey: "codex-thread:session-a",
    threadId: "thread-a",
    controllable: false,
  },
} as Pick<EmployeeData, "_id" | "initialPosition" | "observedRuntime">;

describe("observed skill flow employee resolution", () => {
  it("matches an observed session without substituting a fallback employee", () => {
    expect(resolveObservedSkillFlowEmployee([employee], "session-a")).toBe(employee);
    expect(resolveObservedSkillFlowEmployee([employee], "thread-a")).toBe(employee);
    expect(resolveObservedSkillFlowEmployee([employee], "unknown-session")).toBeUndefined();
  });
});
