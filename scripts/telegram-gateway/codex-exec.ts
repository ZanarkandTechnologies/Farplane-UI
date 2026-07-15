/**
 * Codex exec transport for Telegram-routed messages.
 *
 * Inputs: target Codex session id and prompt text.
 * Outputs: turn ids plus optional assistant response text.
 * Side effects: spawns `codex exec resume` for the target Codex session.
 */

import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";

import type { CodexTurnItem } from "./types";

type CodexExecSpawn = typeof spawn;

type CodexDeliveryImpl = (input: {
  threadId: string;
  text: string;
  appServerUrl?: string;
  responseTimeoutMs?: number;
}) => Promise<{ turnId?: string; responseText?: string }>;

type CodexThreadStartImpl = (input: {
  appServerUrl: string;
  text: string;
  title: string;
  cwd?: string;
  responseTimeoutMs?: number;
}) => Promise<{ threadId: string; turnId?: string; responseText?: string }>;

type CodexAppServerAgentMessage = {
  type?: string;
  id?: string;
  text?: string;
  phase?: string | null;
};

type CodexAppServerTurn = {
  id?: string;
  status?: string;
  error?: unknown;
  items?: CodexAppServerAgentMessage[];
};

type CodexAppServerThread = {
  id?: string;
  status?: { type?: string };
  turns?: CodexAppServerTurn[];
};

export async function sendCodexMessage(input: {
  threadId: string;
  text: string;
  appServerUrl?: string;
  responseTimeoutMs?: number;
  codexImpl?: CodexDeliveryImpl;
  codexExecSpawnImpl?: CodexExecSpawn;
}): Promise<{ ok: boolean; turnId?: string; responseText?: string; error?: string }> {
  try {
    const sent = input.codexImpl
      ? await input.codexImpl({
        threadId: input.threadId,
        text: input.text,
        appServerUrl: input.appServerUrl,
        responseTimeoutMs: input.responseTimeoutMs,
      })
      : input.appServerUrl
        ? await sendCodexMessageWithAppServer({
            appServerUrl: input.appServerUrl,
            threadId: input.threadId,
            text: input.text,
            responseTimeoutMs: input.responseTimeoutMs,
          })
        : await sendCodexMessageWithExec({
            threadId: input.threadId,
            text: input.text,
            responseTimeoutMs: input.responseTimeoutMs,
            spawnImpl: input.codexExecSpawnImpl,
          });
    return { ok: true, turnId: sent.turnId, responseText: sent.responseText };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "codex_send_failed" };
  }
}

export async function startCodexThread(input: {
  appServerUrl: string;
  text: string;
  title: string;
  cwd?: string;
  responseTimeoutMs?: number;
  codexThreadStartImpl?: CodexThreadStartImpl;
}): Promise<{ ok: boolean; threadId?: string; turnId?: string; responseText?: string; error?: string }> {
  try {
    const started = input.codexThreadStartImpl
      ? await input.codexThreadStartImpl({
          appServerUrl: input.appServerUrl,
          text: input.text,
          title: input.title,
          cwd: input.cwd,
          responseTimeoutMs: input.responseTimeoutMs,
        })
      : await startCodexThreadWithAppServer({
          appServerUrl: input.appServerUrl,
          text: input.text,
          title: input.title,
          cwd: input.cwd,
          responseTimeoutMs: input.responseTimeoutMs,
        });
    return {
      ok: true,
      threadId: started.threadId,
      turnId: started.turnId,
      responseText: started.responseText,
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "codex_thread_start_failed" };
  }
}

async function sendCodexMessageWithExec(input: {
  threadId: string;
  text: string;
  responseTimeoutMs?: number;
  spawnImpl?: CodexExecSpawn;
}): Promise<{ turnId?: string; responseText?: string }> {
  const abortController = new AbortController();
  const timeout =
    input.responseTimeoutMs && input.responseTimeoutMs > 0
      ? setTimeout(() => abortController.abort(), input.responseTimeoutMs)
      : undefined;
  try {
    return await runCodexExecResume({
      threadId: input.threadId,
      text: input.text,
      signal: abortController.signal,
      spawnImpl: input.spawnImpl ?? spawn,
    });
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function sendCodexMessageWithAppServer(input: {
  appServerUrl: string;
  threadId: string;
  text: string;
  responseTimeoutMs?: number;
}): Promise<{ turnId?: string; responseText?: string }> {
  const abortController = new AbortController();
  const timeout =
    input.responseTimeoutMs && input.responseTimeoutMs > 0
      ? setTimeout(() => abortController.abort(), input.responseTimeoutMs)
      : undefined;
  let rpc: CodexAppServerRpc | undefined;
  try {
    rpc = await openCodexAppServerRpc(input.appServerUrl, abortController.signal);
    await markAppServerThreadLoaded({ rpc, threadId: input.threadId });
    const baselineTurnId = await latestAppServerTurnId({ rpc, threadId: input.threadId });
    const turn = await rpc<{ turn?: { id?: string }; responseText?: string }>("turn/start", {
      threadId: input.threadId,
      input: [
        {
          type: "text",
          text: input.text,
          text_elements: [],
        },
      ],
    });
    const turnId = turn.turn?.id;
    const immediateResponseText = normalizeAppServerResponseText(turn.responseText);
    const responseText =
      immediateResponseText ??
      (input.responseTimeoutMs === 0
        ? undefined
        : await waitForAppServerTurnResponse({
            rpc,
            threadId: input.threadId,
            turnId,
            baselineTurnId,
            signal: abortController.signal,
          }));
    if (abortController.signal.aborted && turnId) {
      await interruptAppServerTurnIfRunning({ rpc, threadId: input.threadId, turnId });
    }
    return { turnId, responseText };
  } finally {
    rpc?.close();
    if (timeout) clearTimeout(timeout);
  }
}

async function startCodexThreadWithAppServer(input: {
  appServerUrl: string;
  text: string;
  title: string;
  cwd?: string;
  responseTimeoutMs?: number;
}): Promise<{ threadId: string; turnId?: string; responseText?: string }> {
  const abortController = new AbortController();
  const timeout =
    input.responseTimeoutMs && input.responseTimeoutMs > 0
      ? setTimeout(() => abortController.abort(), input.responseTimeoutMs)
      : undefined;
  let rpc: CodexAppServerRpc | undefined;
  try {
    rpc = await openCodexAppServerRpc(input.appServerUrl, abortController.signal);

    const started = await rpc<{ thread?: { id?: string } }>("thread/start", {
      cwd: input.cwd ?? process.cwd(),
    });
    const threadId = started.thread?.id;
    if (!threadId) throw new Error("codex_thread_start_missing_thread_id");
    await rpc("thread/name/set", { threadId, name: input.title });

    const baselineTurnId = await latestAppServerTurnId({ rpc, threadId });
    const turn = await rpc<{ turn?: { id?: string }; responseText?: string }>("turn/start", {
      threadId,
      input: [
        {
          type: "text",
          text: input.text,
          text_elements: [],
        },
      ],
    });
    const turnId = turn.turn?.id;
    const immediateResponseText = normalizeAppServerResponseText(turn.responseText);
    const responseText =
      immediateResponseText ??
      (input.responseTimeoutMs === 0
        ? undefined
        : await waitForAppServerTurnResponse({
            rpc,
            threadId,
            turnId,
            baselineTurnId,
            signal: abortController.signal,
          }));
    if (abortController.signal.aborted && turnId) {
      await interruptAppServerTurnIfRunning({ rpc, threadId, turnId });
    }
    await markAppServerThreadLoaded({ rpc, threadId });
    return { threadId, turnId, responseText };
  } finally {
    rpc?.close();
    if (timeout) clearTimeout(timeout);
  }
}

type CodexAppServerRpc = (<T>(method: string, params: Record<string, unknown>) => Promise<T>) & {
  close: () => void;
};

async function openCodexAppServerRpc(appServerUrl: string, signal: AbortSignal): Promise<CodexAppServerRpc> {
  if (!appServerUrl.startsWith("ws://127.0.0.1") && !appServerUrl.startsWith("ws://localhost")) {
    throw new Error("codex_app_server_url_must_be_local");
  }
  const WebSocketCtor = (globalThis as unknown as { WebSocket?: new (url: string) => unknown }).WebSocket;
  if (!WebSocketCtor) throw new Error("websocket_runtime_unavailable");

  const socket = new WebSocketCtor(appServerUrl) as {
    send: (data: string) => void;
    close: () => void;
    addEventListener: (name: string, cb: (event?: unknown) => void, options?: unknown) => void;
    removeEventListener?: (name: string, cb: (event?: unknown) => void) => void;
  };

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("codex_app_server_open_timeout")), 5000);
    const cleanup = () => clearTimeout(timer);
    signal.addEventListener(
      "abort",
      () => {
        cleanup();
        reject(new Error("codex_response_timeout"));
      },
      { once: true },
    );
    socket.addEventListener(
      "open",
      () => {
        cleanup();
        resolve();
      },
      { once: true },
    );
    socket.addEventListener(
      "error",
      () => {
        cleanup();
        reject(new Error("codex_app_server_unreachable"));
      },
      { once: true },
    );
  });

  let nextId = 1;
  const pending = new Map<
    string | number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }
  >();

  const onMessage = (event?: unknown) => {
    const rawData = (event as { data?: unknown } | undefined)?.data;
    const text = typeof rawData === "string" ? rawData : rawData instanceof Buffer ? rawData.toString("utf-8") : "";
    if (!text) return;
    let parsed: { id?: string | number; result?: unknown; error?: { code?: number; message?: string } };
    try {
      parsed = JSON.parse(text) as { id?: string | number; result?: unknown; error?: { code?: number; message?: string } };
    } catch {
      return;
    }
    if (parsed.id === undefined) return;
    const waiter = pending.get(parsed.id);
    if (!waiter) return;
    pending.delete(parsed.id);
    clearTimeout(waiter.timer);
    if (parsed.error) {
      waiter.reject(new Error(parsed.error.message || `codex_rpc_error:${parsed.error.code ?? "unknown"}`));
      return;
    }
    waiter.resolve(parsed.result);
  };
  socket.addEventListener("message", onMessage);

  const rpc = (async <T>(method: string, params: Record<string, unknown>): Promise<T> => {
    const id = nextId++;
    const result = new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`codex_rpc_timeout:${method}`));
      }, 15000);
      pending.set(id, { resolve, reject, timer });
    });
    socket.send(JSON.stringify({ id, method, params }));
    return (await result) as T;
  }) as CodexAppServerRpc;

  rpc.close = () => {
    socket.removeEventListener?.("message", onMessage);
    for (const waiter of pending.values()) clearTimeout(waiter.timer);
    pending.clear();
    socket.close();
  };

  await rpc("initialize", {
    clientInfo: {
      name: "farplane-telegram-gateway",
      title: "Farplane Telegram Gateway",
      version: "0.1.0",
    },
    capabilities: {
      experimentalApi: true,
      requestAttestation: false,
      optOutNotificationMethods: [],
    },
  });
  socket.send(JSON.stringify({ method: "initialized" }));

  return rpc;
}

async function waitForAppServerTurnResponse(input: {
  rpc: <T>(method: string, params: Record<string, unknown>) => Promise<T>;
  threadId: string;
  turnId?: string;
  baselineTurnId?: string;
  signal: AbortSignal;
}): Promise<string | undefined> {
  let lastResponseText: string | undefined;

  while (true) {
    if (input.signal.aborted) {
      if (lastResponseText) return lastResponseText;
      throw new Error("codex_response_timeout");
    }

    let read: { thread?: CodexAppServerThread };
    try {
      read = await input.rpc<{ thread?: CodexAppServerThread }>("thread/read", {
        threadId: input.threadId,
        includeTurns: true,
      });
    } catch (error) {
      if (input.signal.aborted && lastResponseText) return lastResponseText;
      throw error;
    }
    const turn = findAppServerTurn(read.thread, input.turnId, input.baselineTurnId);
    const responseText = extractAppServerAgentMessageText(turn);
    if (responseText) lastResponseText = responseText;

    if (turn?.status === "failed") {
      throw new Error(formatAppServerTurnError(turn.error));
    }

    const threadIdle = read.thread?.status?.type === "idle";
    const turnComplete = turn?.status === "completed";
    if (!turn && threadIdle) return undefined;
    if (threadIdle || turnComplete) return lastResponseText;

    try {
      await sleep(1000, input.signal);
    } catch (error) {
      if (lastResponseText) return lastResponseText;
      throw error;
    }
  }
}

function findAppServerTurn(
  thread: CodexAppServerThread | undefined,
  turnId: string | undefined,
  baselineTurnId?: string,
): CodexAppServerTurn | undefined {
  const turns = thread?.turns ?? [];
  if (turnId) {
    const matched = turns.find((turn) => turn.id === turnId);
    if (matched) return matched;
    return undefined;
  }
  if (baselineTurnId) {
    const baselineIndex = turns.findIndex((turn) => turn.id === baselineTurnId);
    if (baselineIndex === -1) return undefined;
    return turns.slice(baselineIndex + 1).find((turn) => turn.id);
  }
  return undefined;
}

async function latestAppServerTurnId(input: {
  rpc: <T>(method: string, params: Record<string, unknown>) => Promise<T>;
  threadId: string;
}): Promise<string | undefined> {
  const read = await input.rpc<{ thread?: CodexAppServerThread }>("thread/read", {
    threadId: input.threadId,
    includeTurns: true,
  });
  return read.thread?.turns?.at(-1)?.id;
}

async function interruptAppServerTurnIfRunning(input: {
  rpc: <T>(method: string, params: Record<string, unknown>) => Promise<T>;
  threadId: string;
  turnId: string;
}): Promise<void> {
  try {
    const read = await input.rpc<{ thread?: CodexAppServerThread }>("thread/read", {
      threadId: input.threadId,
      includeTurns: true,
    });
    const turn = findAppServerTurn(read.thread, input.turnId);
    if (turn?.status !== "inProgress") return;
    await input.rpc("turn/interrupt", { threadId: input.threadId, turnId: input.turnId });
  } catch {
    // Timeout cleanup is best-effort; the delivery result should still surface.
  }
}

function normalizeAppServerResponseText(text: string | undefined): string | undefined {
  const trimmed = text?.trim();
  return trimmed ? trimmed : undefined;
}

export const telegramGatewayCodexExecTestInternals = {
  findAppServerTurn,
  normalizeAppServerResponseText,
};

function extractAppServerAgentMessageText(turn: CodexAppServerTurn | undefined): string | undefined {
  const messages =
    turn?.items?.filter((item) => item.type === "agentMessage" && typeof item.text === "string") ?? [];
  const finalAnswer = messages.findLast((item) => item.phase === "final_answer" && item.text?.trim());
  const finalText = finalAnswer?.text?.trim();
  if (finalText) return finalText;
  return messages
    .findLast((item) => item.text?.trim())
    ?.text?.trim();
}

async function markAppServerThreadLoaded(input: {
  rpc: <T>(method: string, params: Record<string, unknown>) => Promise<T>;
  threadId: string;
}): Promise<void> {
  try {
    await input.rpc("thread/resume", { threadId: input.threadId });
  } catch {
    // The Telegram reply is still valid even if the desktop app does not mark the thread loaded.
  }
}

function formatAppServerTurnError(error: unknown): string {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "codex_app_server_turn_failed";
}

async function sleep(ms: number, signal: AbortSignal): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timeout);
        reject(new Error("codex_response_timeout"));
      },
      { once: true },
    );
  });
}

async function runCodexExecResume(input: {
  threadId: string;
  text: string;
  signal: AbortSignal;
  spawnImpl: CodexExecSpawn;
}): Promise<{ turnId?: string; responseText?: string }> {
  const command = process.env.CODEX_CLI_PATH || "codex";
  const args = [
    "exec",
    "--experimental-json",
    "--sandbox",
    "danger-full-access",
    "--config",
    'approval_policy="never"',
  ];
  if (process.env.OPENAI_BASE_URL) {
    args.push("--config", `openai_base_url=${JSON.stringify(process.env.OPENAI_BASE_URL)}`);
  }
  args.push("resume", input.threadId);

  const env = { ...process.env };
  if (!env.CODEX_API_KEY && env.OPENAI_API_KEY) {
    env.CODEX_API_KEY = env.OPENAI_API_KEY;
  }

  const child = input.spawnImpl(command, args, {
    env,
    signal: input.signal,
  }) as ChildProcessWithoutNullStreams;

  let stdoutBuffer = "";
  let stderr = "";
  let finalResponse = "";
  let turnFailure: string | undefined;
  let parseError: Error | undefined;

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    if (parseError) return;
    stdoutBuffer += chunk;
    const lines = stdoutBuffer.split(/\r?\n/u);
    stdoutBuffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      let event: ReturnType<typeof parseCodexExecEvent>;
      try {
        event = parseCodexExecEvent(line);
      } catch (error) {
        parseError = error instanceof Error ? error : new Error("codex_exec_invalid_json");
        return;
      }
      if (event.type === "item.completed") {
        const text = extractCodexExecAgentMessageText(event.item);
        if (text) finalResponse = text;
      } else if (event.type === "turn.failed") {
        turnFailure = event.error?.message || "codex_exec_turn_failed";
      }
    }
  });
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });

  if (child.stdin.writable) {
    child.stdin.write(input.text);
    child.stdin.end();
  }

  await new Promise<void>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => {
      if (parseError) {
        reject(parseError);
        return;
      }
      if (stdoutBuffer.trim()) {
        try {
          const event = parseCodexExecEvent(stdoutBuffer);
          if (event.type === "item.completed") {
            const text = extractCodexExecAgentMessageText(event.item);
            if (text) finalResponse = text;
          } else if (event.type === "turn.failed") {
            turnFailure = event.error?.message || "codex_exec_turn_failed";
          }
        } catch (error) {
          reject(error);
          return;
        }
      }
      if (turnFailure) {
        reject(new Error(turnFailure));
        return;
      }
      if (code !== 0 || signal) {
        const detail = signal ? `signal ${signal}` : `code ${code ?? 1}`;
        reject(new Error(`Codex Exec exited with ${detail}: ${stderr.trim()}`.trim()));
        return;
      }
      resolve();
    });
  });

  return { turnId: input.threadId, responseText: finalResponse.trim() || undefined };
}

function parseCodexExecEvent(line: string): {
  type?: string;
  item?: CodexTurnItem;
  error?: { message?: string };
} {
  try {
    return JSON.parse(line) as {
      type?: string;
      item?: CodexTurnItem;
      error?: { message?: string };
    };
  } catch (error) {
    throw new Error(`codex_exec_invalid_json:${line}`, { cause: error });
  }
}

function extractCodexExecAgentMessageText(item: CodexTurnItem | undefined): string | undefined {
  if (item?.type !== "agent_message" && item?.type !== "agentMessage") return undefined;
  const directText = item.text?.trim();
  if (directText) return directText;
  const contentText = item.content
    ?.map((part) => part.text)
    .filter((text): text is string => Boolean(text?.trim()))
    .join("\n")
    .trim();
  if (contentText) return contentText;
  return undefined;
}
