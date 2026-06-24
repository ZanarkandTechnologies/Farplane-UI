import { describe, expect, it, vi } from "vitest";
import {
  buildThreadLineageTelemetryEnvelope,
  parseThreadLineageEventsFromPayload,
  parseThreadLineageEventsFromStdin,
  publishThreadLineageEvents,
} from "./handler";

describe("thread-lineage-listener", () => {
  it("parses create_thread PostToolUse payloads with child thread ids", () => {
    const rows = parseThreadLineageEventsFromPayload(
      {
        hook_event_name: "PostToolUse",
        toolName: "codex_app.create_thread",
        sessionId: "parent-thread",
        turn_id: "turn-1",
        cwd: "/repo",
        toolInput: { prompt: "redacted by parser", target: { type: "project" } },
        toolResponse: { threadId: "child-thread", title: "Child work" },
      },
      1_000,
    );

    expect(rows).toEqual([
      expect.objectContaining({
        eventName: "thread.created",
        sourceTool: "create_thread",
        parentThreadId: "parent-thread",
        childThreadId: "child-thread",
        title: "Child work",
        projectPath: "/repo",
        turnId: "turn-1",
      }),
    ]);
  });

  it("parses fork_thread payloads with pending worktree ids", () => {
    const rows = parseThreadLineageEventsFromPayload(
      {
        event: "PostToolUse",
        tool: { name: "fork_thread" },
        session: { id: "source-thread" },
        result: { pendingWorktreeId: "pending-123" },
      },
      2_000,
    );

    expect(rows[0]).toEqual(
      expect.objectContaining({
        eventName: "thread.forked",
        sourceTool: "fork_thread",
        parentThreadId: "source-thread",
        pendingWorktreeId: "pending-123",
      }),
    );
  });

  it("ignores unrelated tools and raw transcript fields", () => {
    expect(
      parseThreadLineageEventsFromPayload({
        hook_event_name: "PostToolUse",
        toolName: "Bash",
        toolResponse: "created thread 123",
        transcript: "create_thread should not count here",
      }),
    ).toEqual([]);
  });

  it("ignores thread tools without child or pending ids", () => {
    expect(
      parseThreadLineageEventsFromPayload({
        hook_event_name: "PostToolUse",
        toolName: "create_thread",
        sessionId: "parent",
      }),
    ).toEqual([]);
  });

  it("parses stdin JSON and builds compact telemetry envelopes", () => {
    const rows = parseThreadLineageEventsFromStdin(
      JSON.stringify({
        hook_event_name: "PostToolUse",
        toolName: "fork_thread",
        threadId: "parent",
        output: { threadId: "child" },
      }),
      3_000,
    );

    const envelope = buildThreadLineageTelemetryEnvelope(rows[0]!);
    expect(envelope).toEqual(
      expect.objectContaining({
        hookName: "thread-lineage-listener",
        hookType: "PostToolUse",
        sessionId: "parent",
        payload: expect.objectContaining({
          eventName: "thread.forked",
          childThreadId: "child",
        }),
      }),
    );
    expect(JSON.stringify(envelope)).not.toContain("prompt");
  });

  it("publishes lineage events through the telemetry outbox path", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const rows = parseThreadLineageEventsFromPayload(
      {
        hook_event_name: "PostToolUse",
        toolName: "create_thread",
        sessionId: "parent",
        cwd: "/repo",
        toolResponse: { threadId: "child" },
      },
      4_000,
    );

    const result = await publishThreadLineageEvents(rows, {
      endpointBaseUrl: "http://127.0.0.1:3211",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toMatchObject({ attempted: 1, published: 1, skipped: false });
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://127.0.0.1:3211/telemetry/hooks",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
