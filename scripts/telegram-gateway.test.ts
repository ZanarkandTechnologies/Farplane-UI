import { describe, expect, it, vi } from "vitest";

import {
  appendHistory,
  emptyGatewayState,
  fetchTelegramUpdates,
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

  it("steers active Codex turns and starts idle threads", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            result: { thread: { turns: [{ id: "turn-active", status: "running" }] } },
          }),
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, result: { turn: { id: "turn-active" } } })));

    const result = await sendCodexMessage({
      stateBase: "http://localhost:5173",
      threadId: "thread-a",
      text: "hello",
      fetchImpl,
    });

    expect(result).toEqual({ ok: true, turnId: "turn-active" });
    expect(JSON.parse(String(fetchImpl.mock.calls[1]?.[1]?.body))).toEqual(
      expect.objectContaining({ method: "turn/steer" }),
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
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, result: { thread: { turns: [] } } })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, result: { turn: { id: "turn-new" } } })));

    const processed = await processTelegramUpdate({
      update: updates[0]!,
      state,
      config: { allowedChatIds: ["100"], coordinatorThreadId: "thread-coordinator" },
      stateBase: "http://localhost:5173",
      fetchImpl: sendFetch,
    });

    expect(processed.delivered).toBe(true);
    expect(processed.state.updateOffset).toBe(11);
    expect(JSON.parse(String(sendFetch.mock.calls[1]?.[1]?.body))).toEqual(
      expect.objectContaining({ method: "turn/start" }),
    );
  });
});
