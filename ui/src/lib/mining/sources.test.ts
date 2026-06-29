import { describe, expect, it } from "vitest";
import {
  fileEventToMiningSource,
  historicalThreadSourceToMiningSource,
  providerEventToMiningSource,
  sourceEventToMiningRunRequest,
  ticketCompletionEventToMiningSource,
} from "@/lib/mining/sources";

describe("mining source normalizers", () => {
  it("turns a historical thread into a replayable mining source", () => {
    expect(
      historicalThreadSourceToMiningSource({
        id: "thread-a",
        sessionId: "session-a",
        name: "Decision mining",
        preview: "Need a shared run model",
        cwd: "/tmp/farplane",
        updatedAt: 1_800_000_000_000,
        source: { kind: "farplane-message-window" },
      }),
    ).toEqual({
      sourceId: "thread-a",
      sourceKind: "message_window",
      inputRef: "/tmp/farplane/.farplane/state/message-windows/thread-a.json",
      name: "Decision mining",
      preview: "Need a shared run model",
      cwd: "/tmp/farplane",
      sessionId: "session-a",
      threadId: "thread-a",
      updatedAt: 1_800_000_000,
    });
  });

  it("turns a typed file event into a file-event source", () => {
    expect(
      fileEventToMiningSource({
        eventName: "farplane.ticket.changed",
        eventKey: "local:ticket:TASK-0028:1",
        path: "tickets/TASK-0028/ticket.md",
        entityId: "TASK-0028",
        summary: "Ticket updated",
        provider: "local_file",
      }),
    ).toMatchObject({
      sourceId: "local-ticket-task-0028-1",
      sourceKind: "file_event",
      inputRef: "tickets/TASK-0028/ticket.md",
      ticketId: "TASK-0028",
      sourceEventKey: "local:ticket:TASK-0028:1",
      provider: "local_file",
    });
  });

  it("turns a completed ticket event into a ticket packet source and run request", () => {
    const event = {
      eventName: "farplane.ticket.completed",
      eventKey: "local:ticket:TASK-0028:completed",
      path: "tickets/TASK-0028/ticket.md",
      entityId: "TASK-0028",
      terminal: true,
      summary: "Ticket completed",
    };

    expect(ticketCompletionEventToMiningSource(event)).toMatchObject({
      sourceKind: "ticket_packet",
      ticketId: "TASK-0028",
      sourceEventKey: "local:ticket:TASK-0028:completed",
    });
    expect(sourceEventToMiningRunRequest(event, "ticket-completion-audit-v1")).toMatchObject({
      mode: "ticket_completion",
      source: "hook",
      programId: "ticket-completion-audit-v1",
      sourceEventKey: "local:ticket:TASK-0028:completed",
      sources: [
        {
          sourceKind: "ticket_packet",
          ticketId: "TASK-0028",
        },
      ],
    });
  });

  it("turns provider events into provider mining sources", () => {
    expect(
      providerEventToMiningSource({
        provider: "linear",
        externalId: "LIN-123",
        eventName: "issue.completed",
        ticketId: "TASK-0100",
      }),
    ).toMatchObject({
      sourceId: "linear-lin-123",
      sourceKind: "provider_event",
      inputRef: "linear:LIN-123",
      provider: "linear",
      externalId: "LIN-123",
      ticketId: "TASK-0100",
    });
  });
});
