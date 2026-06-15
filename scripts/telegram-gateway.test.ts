import { describe, expect, it, vi } from "vitest";

import {
  appendHistory,
  emptyGatewayState,
  fetchTelegramUpdates,
  mergeGatewayState,
  processTelegramUpdate,
  recordOutboundMapping,
  resolveTelegramRoute,
  sendCodexMessage,
  sendTelegramNotification,
} from "./telegram-gateway";

describe("telegram gateway routing", () => {
  it("routes direct replies back to the mapped source thread", () => {
    const state = recordOutboundMapping(emptyGatewayState(), {
      telegramMessageId: 42,
      chatId: "100",
      threadId: "thread-source",
      title: "Need decision",
    });

    const route = resolveTelegramRoute(
      {
        update_id: 1,
        message: {
          message_id: 43,
          chat: { id: 100 },
          text: "Approved",
          reply_to_message: { message_id: 42 },
        },
      },
      state,
      { allowedChatIds: ["100"], coordinatorThreadId: "thread-coordinator" },
    );

    expect(route).toEqual(expect.objectContaining({ kind: "source_thread", threadId: "thread-source" }));
  });

  it("recovers direct replies from the source thread footer when local mapping is missing", () => {
    const route = resolveTelegramRoute(
      {
        update_id: 1,
        message: {
          message_id: 44,
          chat: { id: 100 },
          text: "Approved",
          reply_to_message: {
            message_id: 43,
            text: "Farplane live reply test.\nSource thread: 019ec6ed-504d-7ca2-83c2-a438f15248c5",
          },
        },
      },
      emptyGatewayState(),
      { allowedChatIds: ["100"], coordinatorThreadId: "thread-coordinator" },
    );

    expect(route).toEqual(
      expect.objectContaining({
        kind: "source_thread",
        threadId: "019ec6ed-504d-7ca2-83c2-a438f15248c5",
      }),
    );
  });

  it("routes standalone owner messages to the coordinator with recent context", () => {
    const state = appendHistory(
      recordOutboundMapping(emptyGatewayState(), {
        telegramMessageId: 10,
        chatId: "100",
        threadId: "thread-a",
        title: "Question A",
      }),
      {
        telegramMessageId: 9,
        chatId: "100",
        direction: "outbound",
        text: "Question A",
      },
    );

    const route = resolveTelegramRoute(
      { update_id: 2, message: { message_id: 11, chat: { id: "100" }, text: "what needs me?" } },
      state,
      { allowedChatIds: ["100"], coordinatorThreadId: "thread-coordinator" },
    );

    expect(route.kind).toBe("coordinator");
    expect(route).toEqual(expect.objectContaining({ threadId: "thread-coordinator" }));
    expect(route.kind === "coordinator" ? route.prompt : "").toContain("Question A");
  });

  it("queues instead of steering active Codex turns", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, result: { thread: { id: "thread-a" } } })))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            result: { thread: { turns: [{ id: "turn-active", status: "running" }] } },
          }),
        ),
      );

    const result = await sendCodexMessage({
      stateBase: "http://localhost:5173",
      threadId: "thread-a",
      text: "hello",
      responseTimeoutMs: 0,
      fetchImpl,
    });

    expect(result).toEqual({
      ok: false,
      threadActive: true,
      turnId: "turn-active",
      error: "codex_thread_active:turn-active",
    });
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toEqual(
      expect.objectContaining({ method: "thread/resume" }),
    );
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("starts idle Codex threads", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, result: { thread: { id: "thread-a" } } })))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            result: { thread: { turns: [{ id: "turn-old", status: "completed", completedAt: 1 }] } },
          }),
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, result: { turn: { id: "turn-new" } } })));

    const result = await sendCodexMessage({
      stateBase: "http://localhost:5173",
      threadId: "thread-a",
      text: "hello",
      responseTimeoutMs: 0,
      fetchImpl,
    });

    expect(result).toEqual({ ok: true, turnId: "turn-new" });
    expect(JSON.parse(String(fetchImpl.mock.calls[2]?.[1]?.body))).toEqual(
      expect.objectContaining({ method: "turn/start" }),
    );
  });

  it("registers outbound Telegram notifications as local reply mappings", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: true,
          result: { message_id: 77, chat: { id: "100" }, text: "Approve?" },
        }),
      ),
    );

    const result = await sendTelegramNotification({
      token: "token",
      chatId: "100",
      text: "Approve?",
      threadId: "thread-source",
      title: "Approve plan",
      state: emptyGatewayState(),
      fetchImpl,
    });

    expect(result.ok).toBe(true);
    expect(result.messageId).toBe(77);
    expect(result.state.mappings[0]).toEqual(
      expect.objectContaining({ telegramMessageId: 77, threadId: "thread-source" }),
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("merges gateway state without dropping mappings added while the listener is running", () => {
    const listenerState = {
      ...emptyGatewayState(),
      updateOffset: 10,
      mappings: [
        {
          telegramMessageId: 1,
          chatId: "100",
          threadId: "thread-old",
          title: "Old mapping",
          createdAt: 1000,
        },
      ],
      history: [
        {
          telegramMessageId: 3,
          chatId: "100",
          direction: "inbound" as const,
          text: "Done",
          route: "source_thread" as const,
          threadId: "thread-old",
          status: "delivered" as const,
          occurredAt: 3000,
        },
      ],
    };
    const diskState = {
      ...emptyGatewayState(),
      updateOffset: 9,
      mappings: [
        {
          telegramMessageId: 2,
          chatId: "100",
          threadId: "thread-new",
          title: "New mapping",
          createdAt: 2000,
        },
      ],
      history: [],
      pending: [
        {
          telegramMessageId: 3,
          chatId: "100",
          text: "Done",
          route: "source_thread" as const,
          threadId: "thread-old",
          createdAt: 2500,
          attempts: 1,
        },
      ],
    };

    const merged = mergeGatewayState(listenerState, diskState);

    expect(merged.updateOffset).toBe(10);
    expect(merged.mappings.map((mapping) => mapping.telegramMessageId)).toEqual([2, 1]);
    expect(merged.pending).toEqual([]);
  });

  it("polls Telegram and processes a mapped reply into Codex", async () => {
    const fetchUpdates = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: true,
          result: [
            {
              update_id: 10,
              message: {
                message_id: 78,
                chat: { id: "100" },
                text: "Approved",
                reply_to_message: { message_id: 77 },
              },
            },
          ],
        }),
      ),
    );
    const updates = await fetchTelegramUpdates({
      token: "token",
      offset: 0,
      timeoutSeconds: 0,
      fetchImpl: fetchUpdates,
    });
    expect(updates).toHaveLength(1);

    const state = recordOutboundMapping(emptyGatewayState(), {
      telegramMessageId: 77,
      chatId: "100",
      threadId: "thread-source",
    });
    const sendFetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, result: { thread: { id: "thread-source" } } })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, result: { thread: { turns: [] } } })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, result: { turn: { id: "turn-new" } } })));

    const processed = await processTelegramUpdate({
      update: updates[0]!,
      state,
      config: { allowedChatIds: ["100"], coordinatorThreadId: "thread-coordinator", responseTimeoutMs: 0 },
      stateBase: "http://localhost:5173",
      fetchImpl: sendFetch,
    });

    expect(processed.delivered).toBe(true);
    expect(processed.state.updateOffset).toBe(11);
    const turnStartBody = JSON.parse(String(sendFetch.mock.calls[2]?.[1]?.body));
    expect(turnStartBody).toEqual(expect.objectContaining({ method: "turn/start" }));
    expect(turnStartBody.params.input[0].text).toContain("Kenji is messaging from Telegram.");
    expect(turnStartBody.params.input[0].text).toContain("The local Telegram gateway will send your assistant response back");
  });

  it("queues mapped replies when the Codex bridge is temporarily unreachable", async () => {
    const state = recordOutboundMapping(emptyGatewayState(), {
      telegramMessageId: 77,
      chatId: "100",
      threadId: "thread-source",
    });
    const processed = await processTelegramUpdate({
      update: {
        update_id: 10,
        message: {
          message_id: 78,
          chat: { id: "100" },
          text: "Question",
          reply_to_message: { message_id: 77 },
        },
      },
      state,
      config: { allowedChatIds: ["100"], coordinatorThreadId: "thread-coordinator", responseTimeoutMs: 0 },
      stateBase: "http://localhost:5173",
      fetchImpl: vi.fn().mockRejectedValueOnce(new TypeError("fetch failed")),
    });

    expect(processed.delivered).toBe(false);
    expect(processed.error).toBe("queued_delivery_retry");
    expect(processed.state.pending[0]).toEqual(
      expect.objectContaining({
        telegramMessageId: 78,
        route: "source_thread",
        threadId: "thread-source",
        text: "Question",
        lastError: "fetch failed",
      }),
    );
    expect(processed.state.pending[0]?.promptText).toContain("Kenji is messaging from Telegram.");
    expect(processed.state.history[0]).toEqual(
      expect.objectContaining({
        telegramMessageId: 78,
        status: "queued",
        text: "Question",
        error: "fetch failed",
      }),
    );
  });

  it("replies back to Telegram with the Codex agent response", async () => {
    const state = recordOutboundMapping(emptyGatewayState(), {
      telegramMessageId: 77,
      chatId: "100",
      threadId: "thread-source",
    });
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, result: { thread: { id: "thread-source" } } })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, result: { thread: { turns: [] } } })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, result: { turn: { id: "turn-new" } } })))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            result: {
              thread: {
                turns: [
                  {
                    id: "turn-new",
                    status: "completed",
                    completedAt: 123,
                    items: [{ type: "agentMessage", text: "Agent answer" }],
                  },
                ],
              },
            },
          }),
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, result: { message_id: 99 } })));

    const processed = await processTelegramUpdate({
      update: {
        update_id: 10,
        message: {
          message_id: 78,
          chat: { id: "100" },
          text: "Question",
          reply_to_message: { message_id: 77 },
        },
      },
      state,
      config: {
        allowedChatIds: ["100"],
        coordinatorThreadId: "thread-coordinator",
        botToken: "token",
        responseTimeoutMs: 1000,
      },
      stateBase: "http://localhost:5173",
      fetchImpl,
    });

    expect(processed.delivered).toBe(true);
    expect(processed.telegramReplied).toBe(true);
    expect(fetchImpl.mock.calls[4]?.[0]).toBe("https://api.telegram.org/bottoken/sendMessage");
    expect(JSON.parse(String(fetchImpl.mock.calls[4]?.[1]?.body))).toEqual(
      expect.objectContaining({
        chat_id: "100",
        text: "Agent answer",
        reply_parameters: { message_id: 78 },
      }),
    );
  });
});
