import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { EventEmitter } from "node:events";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  appendHistory,
  createReviewRelayBinding,
  defaultStatePath,
  emptyGatewayState,
  fetchTelegramUpdates,
  formatTelegramGatewayMessage,
  mergeGatewayState,
  processTelegramUpdate,
  recordOutboundMapping,
  saveGatewayState,
  resolveTelegramRoute,
  sendCodexMessage,
  sendTelegramDocument,
  sendTelegramNotification,
  sendTelegramPhoto,
  isRetryableCodexDeliveryError,
  isTerminalCodexDeliveryError,
  processPendingMessages,
  queuePendingMessage,
  submitReviewRelayResponse,
  telegramGatewayCodexExecTestInternals,
  validateTelegramArtifactPath,
  validateTelegramPhotoPath,
} from "./telegram-gateway";
import { runTelegramGatewayCli } from "./telegram-gateway/cli";

describe("telegram gateway routing", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

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
      { allowedChatIds: ["100"], defaultThreadId: "thread-ceo" },
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
      { allowedChatIds: ["100"], defaultThreadId: "thread-ceo" },
    );

    expect(route).toEqual(
      expect.objectContaining({
        kind: "source_thread",
        threadId: "019ec6ed-504d-7ca2-83c2-a438f15248c5",
      }),
    );
  });

  it("recovers direct replies from the gateway identity footer when local mapping is missing", () => {
    const threadId = "019ec6ed-504d-7ca2-83c2-a438f15248c5";
    const route = resolveTelegramRoute(
      {
        update_id: 1,
        message: {
          message_id: 44,
          chat: { id: 100 },
          text: "Approved",
          reply_to_message: {
            message_id: 43,
            text: `Done\n\n---\nCodex: Smoke\nThread: ${threadId}`,
          },
        },
      },
      emptyGatewayState(),
      { allowedChatIds: ["100"], defaultThreadId: "thread-ceo" },
    );

    expect(route).toEqual(expect.objectContaining({ kind: "source_thread", threadId }));
  });

  it("formats Telegram gateway messages with a stable source footer", () => {
    expect(
      formatTelegramGatewayMessage({
        text: "Answer",
        title: "Gateway Smoke",
        threadId: "thread-source",
        sessionId: "session-source",
      }).text,
    ).toBe("Answer\n\n---\nCodex: Gateway Smoke\nThread: thread-source\nSession: session-source");
  });

  it("routes standalone owner messages to the default CEO thread", () => {
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
      {
        allowedChatIds: ["100"],
        defaultThreadId: "thread-ceo",
      },
    );

    expect(route.kind).toBe("coordinator");
    expect(route).toEqual(
      expect.objectContaining({ threadId: "thread-ceo", text: "what needs me?" }),
    );
    expect(route.kind === "coordinator" ? route.prompt : "").toBe("what needs me?");
  });

  it("keeps project labels as CEO routing context", () => {
    const route = resolveTelegramRoute(
      { update_id: 2, message: { message_id: 11, chat: { id: "100" }, text: "[UI] fix the panel" } },
      emptyGatewayState(),
      {
        allowedChatIds: ["100"],
        defaultThreadId: "thread-ceo",
      },
    );

    expect(route).toEqual(
      expect.objectContaining({
        kind: "coordinator",
        text: "[UI] fix the panel",
        threadId: "thread-ceo",
      }),
    );
    expect(route.kind === "coordinator" ? route.prompt : "").toBe("[UI] fix the panel");
  });

  it("keeps replies on the mapped source thread even when the text has a label", () => {
    const state = recordOutboundMapping(emptyGatewayState(), {
      telegramMessageId: 42,
      chatId: "100",
      threadId: "thread-farplane",
      title: "Farplane thread",
    });

    const route = resolveTelegramRoute(
      {
        update_id: 2,
        message: {
          message_id: 43,
          chat: { id: "100" },
          text: "[Spira] Whats the status update right now?",
          reply_to_message: { message_id: 42 },
        },
      },
      state,
      {
        allowedChatIds: ["100"],
        defaultThreadId: "thread-ceo",
      },
    );

    expect(route).toEqual(
      expect.objectContaining({
        kind: "source_thread",
        text: "[Spira] Whats the status update right now?",
        threadId: "thread-farplane",
      }),
    );
  });

  it("delivers Codex messages through codex exec resume", async () => {
    const child = new EventEmitter() as EventEmitter & {
      stdout: PassThrough;
      stderr: PassThrough;
      stdin: PassThrough;
    };
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.stdin = new PassThrough();
    const stdinWrite = vi.spyOn(child.stdin, "write");
    const stdinEnd = vi.spyOn(child.stdin, "end");
    const spawnImpl = vi.fn().mockReturnValueOnce(child);

    const promise = sendCodexMessage({
      threadId: "thread-a",
      text: "hello",
      responseTimeoutMs: 1000,
      codexExecSpawnImpl: spawnImpl as never,
    });
    child.stdout.write(`${JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "done" } })}\n`);
    child.stdout.write(`${JSON.stringify({ type: "turn.completed", usage: {} })}\n`);
    child.emit("close", 0, null);
    const result = await promise;

    expect(result).toEqual({ ok: true, turnId: "thread-a", responseText: "done" });
    expect(spawnImpl).toHaveBeenCalledWith(
      "codex",
      [
        "exec",
        "--experimental-json",
        "--sandbox",
        "danger-full-access",
        "--config",
        'approval_policy="never"',
        "resume",
        "thread-a",
      ],
      expect.objectContaining({ env: expect.any(Object), signal: expect.any(AbortSignal) }),
    );
    expect(stdinWrite).toHaveBeenCalledWith("hello");
    expect(stdinEnd).toHaveBeenCalled();
  });

  it("surfaces injected delivery failures as send errors", async () => {
    const result = await sendCodexMessage({
      threadId: "thread-a",
      text: "hello",
      codexImpl: vi.fn().mockRejectedValueOnce(new Error("Codex Exec exited with code 1: auth failed")),
    });

    expect(result).toEqual({ ok: false, error: "Codex Exec exited with code 1: auth failed" });
  });

  it("does not select a stale app-server turn when Telegram turn id is missing", () => {
    const { findAppServerTurn } = telegramGatewayCodexExecTestInternals;
    const thread = {
      turns: [
        { id: "turn-app", status: "completed", items: [{ type: "agentMessage", text: "stale app answer" }] },
      ],
    };

    expect(findAppServerTurn(thread, undefined, "turn-app")).toBeUndefined();
  });

  it("selects the first app-server turn after the Telegram baseline", () => {
    const { findAppServerTurn } = telegramGatewayCodexExecTestInternals;
    const thread = {
      turns: [
        { id: "turn-app", status: "completed", items: [{ type: "agentMessage", text: "stale app answer" }] },
        { id: "turn-telegram", status: "completed", items: [{ type: "agentMessage", text: "fresh telegram answer" }] },
      ],
    };

    expect(findAppServerTurn(thread, undefined, "turn-app")).toEqual(
      expect.objectContaining({ id: "turn-telegram" }),
    );
  });

  it("treats blank app-server response text as missing", () => {
    const { normalizeAppServerResponseText } = telegramGatewayCodexExecTestInternals;

    expect(normalizeAppServerResponseText("")).toBeUndefined();
    expect(normalizeAppServerResponseText("   ")).toBeUndefined();
    expect(normalizeAppServerResponseText(" answer ")).toBe("answer");
  });

  it("surfaces codex exec turn failures as send errors", async () => {
    const child = new EventEmitter() as EventEmitter & {
      stdout: PassThrough;
      stderr: PassThrough;
      stdin: PassThrough;
    };
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.stdin = new PassThrough();
    const spawnImpl = vi.fn().mockReturnValueOnce(child);

    const promise = sendCodexMessage({
      threadId: "thread-a",
      text: "hello",
      codexExecSpawnImpl: spawnImpl as never,
    });
    child.stdout.write(
      `${JSON.stringify({
        type: "turn.failed",
        error: { message: "Codex ran out of room in the model's context window." },
      })}\n`,
    );
    child.emit("close", 1, null);

    await expect(promise).resolves.toEqual({
      ok: false,
      error: "Codex ran out of room in the model's context window.",
    });
  });

  it("surfaces malformed codex exec JSON as send errors", async () => {
    const child = new EventEmitter() as EventEmitter & {
      stdout: PassThrough;
      stderr: PassThrough;
      stdin: PassThrough;
    };
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.stdin = new PassThrough();
    const spawnImpl = vi.fn().mockReturnValueOnce(child);

    const promise = sendCodexMessage({
      threadId: "thread-a",
      text: "hello",
      codexExecSpawnImpl: spawnImpl as never,
    });
    child.stdout.write("not json\n");
    child.emit("close", 0, null);

    await expect(promise).resolves.toEqual(
      expect.objectContaining({
        ok: false,
        error: expect.stringContaining("codex_exec_invalid_json:not json"),
      }),
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
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body)).text).toContain("Thread: thread-source");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("merges disk state before persisting outbound Telegram mappings", async () => {
    const stateDir = await mkdtemp(path.join(os.tmpdir(), "telegram-send-merge-"));
    const statePath = path.join(stateDir, "state.json");
    await saveGatewayState(
      recordOutboundMapping(emptyGatewayState(), {
        telegramMessageId: 76,
        chatId: "100",
        threadId: "thread-existing",
        title: "Existing",
      }),
      statePath,
    );
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
      statePath,
      fetchImpl,
    });

    expect(result.ok).toBe(true);
    const saved = JSON.parse(await readFile(statePath, "utf8"));
    expect(saved.mappings.map((mapping: { telegramMessageId: number }) => mapping.telegramMessageId)).toEqual([77, 76]);
  });

  it("sends explicit local artifacts as Telegram documents with identity captions", async () => {
    const stateDir = await mkdtemp(path.join(os.tmpdir(), "telegram-document-"));
    const filePath = path.join(stateDir, "plan.md");
    await writeFile(filePath, "# Plan\n");
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: true,
          result: { message_id: 88, document: { file_name: "plan.md" } },
        }),
      ),
    );

    const result = await sendTelegramDocument({
      token: "token",
      chatId: "100",
      filePath,
      caption: "Implementation plan",
      threadId: "thread-source",
      sessionId: "session-source",
      title: "Artifact Test",
      state: emptyGatewayState(),
      allowedRoots: [stateDir],
      fetchImpl,
    });

    expect(result.ok).toBe(true);
    expect(result.messageId).toBe(88);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe("https://api.telegram.org/bottoken/sendDocument");
    const body = fetchImpl.mock.calls[0]?.[1]?.body as FormData;
    expect(body.get("chat_id")).toBe("100");
    expect(body.get("caption")).toContain("Thread: thread-source");
    expect(body.get("document")).toBeInstanceOf(Blob);
    expect(result.state.mappings[0]).toEqual(
      expect.objectContaining({ telegramMessageId: 88, threadId: "thread-source", sessionId: "session-source" }),
    );
  });

  it("sends local approval images as reply-routed Telegram photos", async () => {
    const stateDir = await mkdtemp(path.join(os.tmpdir(), "telegram-photo-"));
    const filePath = path.join(stateDir, "approval.png");
    await writeFile(filePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: true,
          result: { message_id: 89, photo: [{ file_id: "photo-1", width: 1080, height: 1920 }] },
        }),
      ),
    );

    const result = await sendTelegramPhoto({
      token: "token",
      chatId: "100",
      filePath,
      caption: "Choose A, B, or C",
      threadId: "thread-source",
      title: "Visual approval",
      state: emptyGatewayState(),
      allowedRoots: [stateDir],
      fetchImpl,
    });

    expect(result.ok).toBe(true);
    expect(result.messageId).toBe(89);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe("https://api.telegram.org/bottoken/sendPhoto");
    const body = fetchImpl.mock.calls[0]?.[1]?.body as FormData;
    expect(body.get("chat_id")).toBe("100");
    expect(body.get("caption")).toContain("Thread: thread-source");
    expect(body.get("photo")).toBeInstanceOf(Blob);
    expect(result.state.mappings[0]).toEqual(
      expect.objectContaining({ telegramMessageId: 89, threadId: "thread-source" }),
    );
  });

  it("rejects unsupported Telegram photo types", async () => {
    const stateDir = await mkdtemp(path.join(os.tmpdir(), "telegram-photo-type-"));
    const filePath = path.join(stateDir, "approval.webp");
    await writeFile(filePath, "not a supported photo");

    await expect(validateTelegramPhotoPath(filePath, [stateDir])).rejects.toThrow(
      /telegram_photo_unsupported_type/,
    );
  });

  it("rejects Telegram artifact paths outside allowed roots", async () => {
    await expect(validateTelegramArtifactPath("/tmp/outside.txt", ["/definitely/not/tmp"])).rejects.toThrow(
      /telegram_artifact_outside_allowed_roots/,
    );
  });

  it("allows ticket artifacts under the configured projects root", async () => {
    const projectRoot = await mkdtemp(path.join(os.tmpdir(), "telegram-project-root-"));
    const photoPath = path.join(projectRoot, "Gagazet", "tickets", "TASK-0019", "approval.png");
    await mkdir(path.dirname(photoPath), { recursive: true });
    await writeFile(photoPath, "png");

    await expect(validateTelegramPhotoPath(photoPath, [projectRoot])).resolves.toMatchObject({
      filePath: photoPath,
      mimeType: "image/png",
    });
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

  it("does not resurrect terminally failed pending messages during state merges", () => {
    const pendingState = queuePendingMessage(emptyGatewayState(), {
      telegramMessageId: 2249,
      chatId: "100",
      text: "Question",
      route: "source_thread",
      threadId: "thread-source",
    });
    const terminalState = appendHistory(emptyGatewayState(), {
      telegramMessageId: 2249,
      chatId: "100",
      direction: "inbound",
      text: "Question",
      route: "source_thread",
      threadId: "thread-source",
      status: "failed",
      error: "Codex ran out of room in the model's context window. Start a new thread or clear earlier history before retrying.",
    });

    const merged = mergeGatewayState(terminalState, pendingState);

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
    const pollUrl = fetchUpdates.mock.calls[0]?.[0] as URL;
    expect(pollUrl.pathname).toBe("/bottoken/getUpdates");
    expect(pollUrl.searchParams.get("timeout")).toBe("0");
    expect(pollUrl.searchParams.get("allowed_updates")).toBe("[\"message\"]");

    const state = recordOutboundMapping(emptyGatewayState(), {
      telegramMessageId: 77,
      chatId: "100",
      threadId: "thread-source",
    });
    const codexImpl = vi.fn().mockResolvedValueOnce({ turnId: "thread-source" });

    const processed = await processTelegramUpdate({
      update: updates[0]!,
      state,
      config: { allowedChatIds: ["100"], defaultThreadId: "thread-ceo", responseTimeoutMs: 0 },
      codexImpl,
    });

    expect(processed.delivered).toBe(true);
    expect(processed.state.updateOffset).toBe(11);
    expect(codexImpl.mock.calls[0]?.[0].threadId).toBe("thread-source");
    expect(codexImpl.mock.calls[0]?.[0].text).toBe("Approved");
  });

  it("routes standalone Telegram messages to the CEO thread and maps the response", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, result: { message_id: 99 } })),
    );
    const codexImpl = vi.fn().mockResolvedValueOnce({ turnId: "thread-ceo", responseText: "CEO answer" });

    const processed = await processTelegramUpdate({
      update: {
        update_id: 10,
        message: {
          message_id: 78,
          chat: { id: "100" },
          text: "start a fresh topic",
        },
      },
      state: emptyGatewayState(),
      config: {
        allowedChatIds: ["100"],
        defaultThreadId: "thread-ceo",
        botToken: "token",
        responseTimeoutMs: 1000,
      },
      fetchImpl,
      codexImpl,
    });

    expect(processed.delivered).toBe(true);
    expect(processed.telegramReplied).toBe(true);
    expect(processed.route.kind).toBe("coordinator");
    expect(codexImpl.mock.calls[0]?.[0].threadId).toBe("thread-ceo");
    expect(codexImpl.mock.calls[0]?.[0].text).toBe("start a fresh topic");
    expect(processed.state.mappings[0]).toEqual(
      expect.objectContaining({
        telegramMessageId: 99,
        chatId: "100",
        threadId: "thread-ceo",
        title: "Telegram coordinator",
      }),
    );
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toEqual(
      expect.objectContaining({
        chat_id: "100",
        text: expect.stringContaining("CEO answer"),
        reply_parameters: { message_id: 78 },
      }),
    );
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body)).text).toContain(
      "Thread: thread-ceo",
    );
  });

  it("does not persist offsets or history during dry-run polling", async () => {
    const stateDir = await mkdtemp(path.join(os.tmpdir(), "telegram-gateway-dry-run-"));
    vi.stubEnv("FARPLANE_STATE_DIR", stateDir);
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "token");
    vi.stubEnv("TELEGRAM_ALLOW_FROM", "100");
    const statePath = defaultStatePath();
    await saveGatewayState(
      recordOutboundMapping(emptyGatewayState(), {
        telegramMessageId: 77,
        chatId: "100",
        threadId: "thread-source",
      }),
      statePath,
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            result: [
              {
                update_id: 10,
                message: {
                  message_id: 78,
                  chat: { id: "100" },
                  text: "Question",
                  reply_to_message: { message_id: 77 },
                },
              },
            ],
          }),
        ),
      ),
    );

    await runTelegramGatewayCli(["--once", "--dry-run"]);

    const state = JSON.parse(await readFile(statePath, "utf8"));
    expect(state.updateOffset).toBe(0);
    expect(state.history).toEqual([]);
    expect(state.pending).toEqual([]);
  });

  it("merges route rows added while polling before routing returned updates", async () => {
    const stateDir = await mkdtemp(path.join(os.tmpdir(), "telegram-gateway-poll-race-"));
    vi.stubEnv("FARPLANE_STATE_DIR", stateDir);
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "token");
    vi.stubEnv("TELEGRAM_ALLOW_FROM", "100");
    const statePath = defaultStatePath();
    await saveGatewayState(emptyGatewayState(), statePath);
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementationOnce(async () => {
        await saveGatewayState(
          recordOutboundMapping(emptyGatewayState(), {
            telegramMessageId: 77,
            chatId: "100",
            threadId: "thread-source",
          }),
          statePath,
        );
        return new Response(
          JSON.stringify({
            ok: true,
            result: [
              {
                update_id: 10,
                message: {
                  message_id: 78,
                  chat: { id: "100" },
                  text: "Question",
                  reply_to_message: { message_id: 77 },
                },
              },
            ],
          }),
        );
      }),
    );

    await runTelegramGatewayCli(["--once", "--dry-run"]);

    const summary = JSON.parse(String(consoleSpy.mock.calls.at(-1)?.[0]));
    expect(summary.results[0]).toEqual(expect.objectContaining({ route: "source_thread", delivered: true }));
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
      config: { allowedChatIds: ["100"], defaultThreadId: "thread-ceo", responseTimeoutMs: 0 },
      codexImpl: vi.fn().mockRejectedValueOnce(new TypeError("fetch failed")),
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
    expect(processed.state.pending[0]?.promptText).toBe("Question");
    expect(processed.state.history[0]).toEqual(
      expect.objectContaining({
        telegramMessageId: 78,
        status: "queued",
        text: "Question",
        error: "fetch failed",
      }),
    );
  });

  it("treats transient thread-store read errors as retryable delivery failures", async () => {
    expect(
      isRetryableCodexDeliveryError(
        "failed to read thread: thread-store internal error: failed to read thread /tmp/session.jsonl",
      ),
    ).toBe(true);
  });

  it("treats aborted codex exec turns as retryable delivery failures", async () => {
    expect(isRetryableCodexDeliveryError("The operation was aborted")).toBe(true);
    expect(isRetryableCodexDeliveryError("AbortError: This operation was aborted")).toBe(true);
  });

  it("treats context-window exhaustion as terminal delivery failure", async () => {
    expect(
      isTerminalCodexDeliveryError(
        "Codex ran out of room in the model's context window. Start a new thread or clear earlier history before retrying.",
      ),
    ).toBe(true);
  });

  it("treats archived Codex sessions as terminal delivery failures", async () => {
    expect(
      isTerminalCodexDeliveryError(
        "Error: thread/resume: thread/resume failed: session 019ec6ed-504d-7ca2-83c2-a438f15248c5 is archived. Run `codex unarchive 019ec6ed-504d-7ca2-83c2-a438f15248c5` to unarchive it first. (code -32600)",
      ),
    ).toBe(true);
  });

  it("removes terminal pending failures and replies to Telegram with the failure reason", async () => {
    const state = queuePendingMessage(emptyGatewayState(), {
      telegramMessageId: 2249,
      chatId: "100",
      text: "Question",
      promptText: "Prompt",
      route: "source_thread",
      threadId: "thread-source",
    });
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, result: { message_id: 2250 } })),
    );
    const error =
      "Codex ran out of room in the model's context window. Start a new thread or clear earlier history before retrying.";

    const result = await processPendingMessages({
      state,
      config: { allowedChatIds: ["100"], defaultThreadId: "thread-ceo", botToken: "token" },
      fetchImpl,
      codexImpl: vi.fn().mockRejectedValueOnce(new Error(error)),
    });

    expect(result.failed).toBe(1);
    expect(result.state.pending).toEqual([]);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe("https://api.telegram.org/bottoken/sendMessage");
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toEqual(
      expect.objectContaining({
        chat_id: "100",
        reply_parameters: { message_id: 2249 },
      }),
    );
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body)).text).toContain("could not accept the turn");
  });

  it("replies back to Telegram with the Codex agent response", async () => {
    const state = recordOutboundMapping(emptyGatewayState(), {
      telegramMessageId: 77,
      chatId: "100",
      threadId: "thread-source",
    });
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, result: { message_id: 99 } })),
    );
    const codexImpl = vi.fn().mockResolvedValueOnce({ turnId: "thread-source", responseText: "Agent answer" });

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
        defaultThreadId: "thread-ceo",
        botToken: "token",
        responseTimeoutMs: 1000,
      },
      fetchImpl,
      codexImpl,
    });

    expect(processed.delivered).toBe(true);
    expect(processed.telegramReplied).toBe(true);
    expect(processed.state.mappings[0]).toEqual(
      expect.objectContaining({
        telegramMessageId: 99,
        chatId: "100",
        threadId: "thread-source",
      }),
    );
    expect(fetchImpl.mock.calls[0]?.[0]).toBe("https://api.telegram.org/bottoken/sendMessage");
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toEqual(
      expect.objectContaining({
        chat_id: "100",
        text: expect.stringContaining("Agent answer"),
        reply_parameters: { message_id: 78 },
      }),
    );
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body)).text).toContain("Thread: thread-source");
  });

  it("submits a scoped Phone Chaser review response to the bound Codex thread", async () => {
    const binding = createReviewRelayBinding({
      state: emptyGatewayState(),
      threadId: "thread-source",
      title: "TASK-0351 artifact review",
      reviewId: "review-task-0351",
      capability: "capability-secret",
      now: 1000,
      ttlMs: 60_000,
    });
    const codexImpl = vi.fn().mockResolvedValueOnce({ turnId: "turn-review" });

    const result = await submitReviewRelayResponse({
      state: binding.state,
      config: { allowedChatIds: [], responseTimeoutMs: 0 },
      reviewId: binding.reviewId,
      capability: binding.capability,
      decision: "approve",
      reason: "ready to use",
      idempotencyKey: "call-1",
      now: 2000,
      codexImpl,
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe("delivered");
    expect(codexImpl.mock.calls[0]?.[0].threadId).toBe("thread-source");
    expect(codexImpl.mock.calls[0]?.[0].appServerUrl).toBeUndefined();
    expect(codexImpl.mock.calls[0]?.[0].text).toContain("Decision: approve");
    expect(codexImpl.mock.calls[0]?.[0].text).toContain("Do not publish, spend, deploy");
    expect(result.state.reviewBindings[0]?.usedAt).toBe(2000);
    expect(result.state.reviewReceipts[0]).toEqual(
      expect.objectContaining({
        reviewId: "review-task-0351",
        idempotencyKey: "call-1",
        status: "delivered",
        decision: "approve",
      }),
    );
  });

  it("rejects Phone Chaser review submissions with the wrong capability", async () => {
    const binding = createReviewRelayBinding({
      state: emptyGatewayState(),
      threadId: "thread-source",
      reviewId: "review-task-0351",
      capability: "capability-secret",
      now: 1000,
      ttlMs: 60_000,
    });

    const result = await submitReviewRelayResponse({
      state: binding.state,
      config: { allowedChatIds: [], responseTimeoutMs: 0 },
      reviewId: binding.reviewId,
      capability: "wrong",
      decision: "approve",
      reason: "ready",
      idempotencyKey: "call-1",
      now: 2000,
      codexImpl: vi.fn(),
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("invalid_capability");
    expect(result.state.reviewReceipts[0]).toEqual(expect.objectContaining({ status: "rejected" }));
  });

  it("keeps Phone Chaser review submissions idempotent", async () => {
    const binding = createReviewRelayBinding({
      state: emptyGatewayState(),
      threadId: "thread-source",
      reviewId: "review-task-0351",
      capability: "capability-secret",
      now: 1000,
      ttlMs: 60_000,
    });
    const first = await submitReviewRelayResponse({
      state: binding.state,
      config: { allowedChatIds: [], responseTimeoutMs: 0 },
      reviewId: binding.reviewId,
      capability: binding.capability,
      decision: "revise",
      reason: "tighten the lead",
      idempotencyKey: "call-1",
      now: 2000,
      codexImpl: vi.fn().mockResolvedValueOnce({ turnId: "turn-review" }),
    });

    const replay = await submitReviewRelayResponse({
      state: first.state,
      config: { allowedChatIds: [], responseTimeoutMs: 0 },
      reviewId: binding.reviewId,
      capability: binding.capability,
      decision: "revise",
      reason: "tighten the lead",
      idempotencyKey: "call-1",
      now: 3000,
      codexImpl: vi.fn(),
    });

    expect(replay.ok).toBe(true);
    expect(replay.idempotent).toBe(true);
    expect(replay.state.reviewReceipts).toHaveLength(1);
  });

  it("rejects expired, reused, invalid-decision, and oversized Phone Chaser review submissions", async () => {
    const binding = createReviewRelayBinding({
      state: emptyGatewayState(),
      threadId: "thread-source",
      reviewId: "review-task-0351",
      capability: "capability-secret",
      now: 1000,
      ttlMs: 10,
    });

    await expect(
      submitReviewRelayResponse({
        state: binding.state,
        config: { allowedChatIds: [], responseTimeoutMs: 0 },
        reviewId: binding.reviewId,
        capability: binding.capability,
        decision: "maybe",
        reason: "ready",
        idempotencyKey: "call-1",
        now: 1001,
      }),
    ).rejects.toThrow(/invalid_decision/);

    await expect(
      submitReviewRelayResponse({
        state: binding.state,
        config: { allowedChatIds: [], responseTimeoutMs: 0 },
        reviewId: binding.reviewId,
        capability: binding.capability,
        decision: "approve",
        reason: "x".repeat(501),
        idempotencyKey: "call-1",
        now: 1001,
      }),
    ).rejects.toThrow(/reason_too_large/);

    const expired = await submitReviewRelayResponse({
      state: binding.state,
      config: { allowedChatIds: [], responseTimeoutMs: 0 },
      reviewId: binding.reviewId,
      capability: binding.capability,
      decision: "approve",
      reason: "ready",
      idempotencyKey: "call-1",
      now: 2000,
    });

    expect(expired.ok).toBe(false);
    expect(expired.error).toBe("review_expired");
  });

  it("queues Phone Chaser review responses when Codex delivery is temporarily unavailable", async () => {
    const binding = createReviewRelayBinding({
      state: emptyGatewayState(),
      threadId: "thread-source",
      reviewId: "review-task-0351",
      capability: "capability-secret",
      now: 1000,
      ttlMs: 60_000,
    });

    const result = await submitReviewRelayResponse({
      state: binding.state,
      config: { allowedChatIds: [], responseTimeoutMs: 0 },
      reviewId: binding.reviewId,
      capability: binding.capability,
      decision: "reject",
      reason: "wrong artifact",
      idempotencyKey: "call-1",
      now: 2000,
      codexImpl: vi.fn().mockRejectedValueOnce(new TypeError("fetch failed")),
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe("queued");
    expect(result.state.pending[0]).toEqual(
      expect.objectContaining({
        route: "review_relay",
        threadId: "thread-source",
        reviewId: "review-task-0351",
        reviewDecision: "reject",
        reviewReason: "wrong artifact",
        idempotencyKey: "call-1",
        lastError: "fetch failed",
      }),
    );
    expect(result.state.reviewReceipts[0]).toEqual(expect.objectContaining({ status: "queued" }));

    const retried = await processPendingMessages({
      state: result.state,
      config: { allowedChatIds: [], responseTimeoutMs: 0 },
      codexImpl: vi.fn().mockResolvedValueOnce({ turnId: "turn-after-retry" }),
    });

    expect(retried.processed).toBe(1);
    expect(retried.state.pending).toEqual([]);
    expect(retried.state.reviewReceipts[0]).toEqual(
      expect.objectContaining({
        reviewId: "review-task-0351",
        idempotencyKey: "call-1",
        status: "delivered",
        turnId: "turn-after-retry",
      }),
    );
  });
});
