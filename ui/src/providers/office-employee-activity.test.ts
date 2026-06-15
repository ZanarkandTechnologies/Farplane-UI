import { describe, expect, it } from "vitest";

import { deriveEmployeeActivity } from "./office-employee-activity";

describe("office employee activity mapping", () => {
  it("labels completed Codex replies as ready for scan-friendly notifications", () => {
    expect(
      deriveEmployeeActivity({
        agentId: "codex-thread:ready-thread",
        state: "done",
        statusText: "Codex response ready.",
        bubbles: [{ id: "codex-thread-update-ready", label: "Update ready", weight: 100 }],
      }),
    ).toEqual({
      state: "done",
      label: "Ready",
      detail: "Codex response ready.",
    });
  });

  it("keeps generic done states labeled as done", () => {
    expect(
      deriveEmployeeActivity({
        agentId: "worker",
        state: "done",
        statusText: "Heartbeat finished.",
        bubbles: [],
      }),
    ).toEqual({
      state: "done",
      label: "Done",
      detail: "Heartbeat finished.",
    });
  });
});
