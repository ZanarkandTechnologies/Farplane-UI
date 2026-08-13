import { describe, expect, it } from "vitest";
import { agentIdFromThreadId } from "./task-detail-modal.helpers";

describe("agentIdFromThreadId", () => {
  it("maps a ticket-owned Codex thread id to the session identity used by the UI", () => {
    expect(agentIdFromThreadId("019f-task-thread")).toBe("codex-thread:019f-task-thread");
  });

  it("does not manufacture an inspectable worker for an unbound ticket", () => {
    expect(agentIdFromThreadId(undefined)).toBeNull();
    expect(agentIdFromThreadId("   ")).toBeNull();
  });
});
