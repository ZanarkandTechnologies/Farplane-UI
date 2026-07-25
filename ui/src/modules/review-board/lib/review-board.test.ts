import { describe, expect, it } from "vitest";

import { countReviewLaneTasks, resolveReviewBoardTasks, reviewBoardTaskKey } from "./review-board";

describe("review board helpers", () => {
  it("keeps an empty filesystem projection empty", () => {
    const resolved = resolveReviewBoardTasks([]);

    expect(resolved).toEqual([]);
    expect(countReviewLaneTasks(resolved)).toBe(0);
  });

  it("normalizes canonical filesystem task fields and memory", () => {
    const resolved = resolveReviewBoardTasks([
      {
        id: "TASK-0001",
        projectId: "project-a",
        title: "Live planning task",
        status: "review",
        approvalState: "approved",
        artefactPath: "tickets/TASK-0001/ticket.md",
        markdown: "# TASK-0001\n\nCanonical memory",
        frontMatter: { claimed_by: "codex-123" },
      },
    ]);

    expect(resolved).toEqual([
      expect.objectContaining({
        id: "TASK-0001",
        projectId: "project-a",
        title: "Live planning task",
        approvalState: "approved",
        artefactPath: "tickets/TASK-0001/ticket.md",
        markdown: "# TASK-0001\n\nCanonical memory",
        frontMatter: { claimed_by: "codex-123" },
      }),
    ]);
  });

  it("uses project scope when keying identical ticket ids", () => {
    expect(reviewBoardTaskKey({ id: "TASK-0001", projectId: "project-a" })).not.toBe(
      reviewBoardTaskKey({ id: "TASK-0001", projectId: "project-b" }),
    );
  });
});
