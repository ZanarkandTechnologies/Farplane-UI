import { describe, expect, it, vi } from "vitest";
import { handleFileChangeWithCore, publishCoreFileEventMirrors } from "./core-mining-adapter";

describe("Core file-change mining adapter", () => {
  it("passes the raw payload to Core without assigning a program in the UI", async () => {
    const runner = vi.fn(async () => ({
      events: [{ event_id: "event-1", event_name: "farplane.ticket.completed" }],
    }));
    const stdin = JSON.stringify({ event: "PostToolUse", cwd: "/repo" });

    const events = await handleFileChangeWithCore(stdin, "/repo", runner);

    expect(runner).toHaveBeenCalledWith({
      args: ["mining", "handle-file-change", "--payload", "-", "--json"],
      cwd: "/repo",
      stdin,
    });
    expect(events).toEqual([{ event_id: "event-1", event_name: "farplane.ticket.completed" }]);
    expect(JSON.stringify(runner.mock.calls)).not.toContain("ticket-completion-audit-v1");
  });

  it("mirrors Core records without becoming the delivery authority", async () => {
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    const result = await publishCoreFileEventMirrors(
      [
        {
          schema_version: 1,
          event_id: "a".repeat(64),
          event_key: `farplane-file-event:${"a".repeat(64)}`,
          event_name: "farplane.ticket.completed",
          project_id: "project-1",
          event_at: "2026-07-12T00:00:00Z",
          entity_ref: { kind: "ticket", id: "TASK-0330" },
          privacy_safe_delta: { changed_fields: [] },
        },
      ],
      {
        endpointBaseUrl: "http://127.0.0.1:3211",
        fetchImpl: fetchImpl as unknown as typeof fetch,
        projectPath: "/repo",
      },
    );

    expect(result).toMatchObject({ attempted: 1, published: 1, skipped: false });
    const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body));
    expect(body.payload).toEqual(
      expect.objectContaining({ eventName: "farplane.ticket.completed", source: "farplane_core" }),
    );
    expect(JSON.stringify(body)).not.toContain("programRef");
  });
});
