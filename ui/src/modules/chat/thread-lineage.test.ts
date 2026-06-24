import { describe, expect, it } from "vitest";

import { chatThreadListContains, organizeChatThreadsByLineage } from "./thread-lineage";

describe("chat thread lineage", () => {
  it("nests runtime child sessions under their parent conversation", () => {
    const organized = organizeChatThreadsByLineage({
      threads: [
        {
          _id: "codex-thread:parent",
          title: "Parent",
          sessionKey: "codex-thread:parent",
        },
        {
          _id: "codex-thread:child",
          title: "Child",
          parentThreadId: "parent",
          sessionKey: "codex-thread:child",
        },
      ],
    });

    expect(organized.threads).toEqual([expect.objectContaining({ _id: "codex-thread:parent" })]);
    expect(organized.subthreadsMap["codex-thread:parent"]).toEqual([
      expect.objectContaining({
        _id: "codex-thread:child",
        parentThreadId: "codex-thread:parent",
      }),
    ]);
    expect(chatThreadListContains(organized.allThreads, "codex-thread:child")).toBe(true);
  });

  it("adds telemetry-only child threads without promoting pending worktrees", () => {
    const organized = organizeChatThreadsByLineage({
      selectedAgentId: "codex-thread:parent",
      threads: [
        {
          _id: "codex-thread:parent",
          title: "Parent",
          sessionKey: "codex-thread:parent",
        },
      ],
      lineageEdges: [
        {
          source: "parent",
          target: "child",
          kind: "created",
          title: "Child implementation",
        },
        {
          source: "parent",
          target: "pending:worktree",
          kind: "forked",
          title: "Pending worktree",
        },
      ],
    });

    expect(organized.threads).toHaveLength(1);
    expect(organized.subthreadsMap["codex-thread:parent"]).toEqual([
      expect.objectContaining({
        _id: "codex-thread:child",
        agentId: "codex-thread:parent",
        title: "Child implementation",
      }),
    ]);
    expect(JSON.stringify(organized)).not.toContain("pending:worktree");
  });
});
