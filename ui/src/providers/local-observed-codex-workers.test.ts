import { describe, expect, it } from "vitest";

import { localFarplaneEventsToObservedCodexWorkers } from "./local-observed-codex-workers";

describe("localFarplaneEventsToObservedCodexWorkers", () => {
  it("maps local Farplane hook JSONL rows into read-only observed Codex workers", () => {
    const rows = [
      {
        event_id: "evt-start",
        event_type: "turn_start",
        hook_name: "UserPromptSubmit",
        metadata: {
          cwd: "/work/farplane",
          hostname: "studio.local",
        },
        project_name: "Farplane UI",
        project_root: "/work/farplane",
        session_id: "session-1",
        summary: "user turn captured",
        timestamp: "2026-06-24T05:41:01.120Z",
        turn_id: "turn-1",
      },
      {
        event_id: "evt-stop",
        event_type: "hook_result",
        hook_name: "Stop",
        metadata: {
          cwd: "/work/farplane",
          hostname: "studio.local",
        },
        project_name: "Farplane UI",
        project_root: "/work/farplane",
        session_id: "session-1",
        summary: "",
        timestamp: "2026-06-24T05:42:01.120Z",
        turn_id: "turn-1",
      },
    ];

    const workers = localFarplaneEventsToObservedCodexWorkers(rows, {
      now: Date.parse("2026-06-24T05:43:01.120Z"),
      rangeMs: 5 * 60 * 1000,
    });

    expect(workers).toEqual([
      expect.objectContaining({
        workerId: "codex-observed:studio.local:codex-proj-work-farplane:session-1",
        sourceInstanceId: "studio.local",
        machineName: "studio.local",
        sessionKey: "session-1",
        threadId: "session-1",
        projectId: "codex-proj-work-farplane",
        projectPath: "/work/farplane",
        state: "done",
        statusText: "Codex turn completed",
        controllable: false,
      }),
    ]);
  });

  it("filters local rows outside the requested discovery window", () => {
    const workers = localFarplaneEventsToObservedCodexWorkers(
      [
        {
          event_id: "evt-old",
          event_type: "turn_start",
          hook_name: "UserPromptSubmit",
          metadata: { hostname: "studio.local" },
          project_name: "Farplane UI",
          project_root: "/work/farplane",
          session_id: "session-old",
          timestamp: "2026-06-20T05:41:01.120Z",
          turn_id: "turn-old",
        },
      ],
      {
        now: Date.parse("2026-06-24T05:43:01.120Z"),
        rangeMs: 24 * 60 * 60 * 1000,
      },
    );

    expect(workers).toEqual([]);
  });
});
