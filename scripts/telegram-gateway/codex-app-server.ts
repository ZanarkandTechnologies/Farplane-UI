/**
 * Codex app-server transport for Telegram-routed messages.
 *
 * Inputs: local Codex app-server WebSocket URL, target thread id, and prompt text.
 * Outputs: turn ids plus optional assistant response text.
 * Side effects: local WebSocket RPC calls to Codex app-server.
 */

import type { CodexTurn, JsonRpcMessage } from "./types";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendCodexMessage(input: {
  codexAppServerUrl?: string;
  stateBase?: string;
  threadId: string;
  text: string;
  responseTimeoutMs?: number;
  responsePollMs?: number;
  fetchImpl?: typeof fetch;
  rpcImpl?: <T>(method: string, params: Record<string, unknown>) => Promise<T>;
}): Promise<{ ok: boolean; turnId?: string; responseText?: string; threadActive?: boolean; error?: string }> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const httpRpc = async <T>(method: string, params: Record<string, unknown>): Promise<T> => {
    if (!input.stateBase) throw new Error("codex_app_server_url_missing");
    const stateBase = input.stateBase.replace(/\/+$/, "");
    const response = await fetchImpl(`${stateBase}/codex/app-server/rpc`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ method, params }),
    });
    const payload = (await response.json()) as { ok?: boolean; result?: T; error?: string };
    if (!response.ok || payload.ok === false) {
      throw new Error(payload.error ?? `codex_rpc_failed:${method}`);
    }
    return payload.result as T;
  };
  const directRpc = async <T>(method: string, params: Record<string, unknown>): Promise<T> => {
    if (!input.codexAppServerUrl) return httpRpc<T>(method, params);
    return await requestCodexAppServerRpc(input.codexAppServerUrl, method, params) as T;
  };
  const rpc = input.rpcImpl ?? directRpc;

  try {
    await rpc<{ thread?: unknown }>(
      "thread/resume",
      { threadId: input.threadId },
    );
    const read = await rpc<{ thread?: { turns?: CodexTurn[] } }>(
      "thread/read",
      { threadId: input.threadId, includeTurns: true },
    );
    const activeTurn = [...(read.thread?.turns ?? [])].reverse().find((turn) => {
      const status = turn.status?.toLowerCase() ?? "";
      return !turn.completedAt && status !== "completed" && status !== "failed" && status !== "cancelled";
    });
    if (activeTurn) {
      return {
        ok: false,
        threadActive: true,
        turnId: activeTurn.id,
        error: `codex_thread_active:${activeTurn.id}`,
      };
    }
    const result = await rpc<{ turn?: { id?: string } }>("turn/start", {
      threadId: input.threadId,
      input: [{ type: "text", text: input.text, text_elements: [] }],
    });
    const turnId = result.turn?.id;
    const responseTimeoutMs = input.responseTimeoutMs ?? 120000;
    if (!turnId || responseTimeoutMs <= 0) return { ok: true, turnId };
    const deadline = Date.now() + responseTimeoutMs;
    while (Date.now() <= deadline) {
      const nextRead = await rpc<{ thread?: { turns?: CodexTurn[] } }>(
        "thread/read",
        { threadId: input.threadId, includeTurns: true },
      );
      const turn = (nextRead.thread?.turns ?? []).find((candidate) => candidate.id === turnId);
      const responseText = extractTurnResponseText(turn);
      if (responseText) return { ok: true, turnId, responseText };
      const status = turn?.status?.toLowerCase() ?? "";
      if (turn?.completedAt || status === "completed" || status === "failed" || status === "cancelled") {
        return { ok: true, turnId };
      }
      await sleep(input.responsePollMs ?? 1000);
    }
    return { ok: true, turnId };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "codex_send_failed" };
  }
}

export async function requestCodexAppServerRpc(
  appServerUrl: string,
  method: string,
  params: unknown,
): Promise<unknown> {
  assertLocalCodexAppServerUrl(appServerUrl);
  const WebSocketCtor = (globalThis as unknown as { WebSocket?: new (url: string) => unknown }).WebSocket;
  if (!WebSocketCtor) {
    throw new Error("websocket_runtime_unavailable");
  }

  const socket = new WebSocketCtor(appServerUrl) as {
    send: (data: string) => void;
    close: () => void;
    addEventListener: (name: string, cb: (event?: unknown) => void, options?: unknown) => void;
    removeEventListener?: (name: string, cb: (event?: unknown) => void) => void;
  };

  const waitForOpen = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("codex_app_server_open_timeout")), 5000);
    socket.addEventListener("open", () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
    socket.addEventListener("error", () => {
      clearTimeout(timer);
      reject(new Error("codex_app_server_unreachable"));
    }, { once: true });
  });

  await waitForOpen;

  let nextId = 1;
  const pending = new Map<
    string | number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();

  const onMessage = (event?: unknown) => {
    const rawData = (event as { data?: unknown } | undefined)?.data;
    const text = typeof rawData === "string" ? rawData : rawData instanceof Buffer ? rawData.toString("utf8") : "";
    if (!text) return;
    let parsed: JsonRpcMessage;
    try {
      parsed = JSON.parse(text) as JsonRpcMessage;
    } catch {
      return;
    }
    if (parsed.id === undefined) return;
    const waiter = pending.get(parsed.id);
    if (!waiter) return;
    pending.delete(parsed.id);
    if (parsed.error) {
      waiter.reject(new Error(parsed.error.message || `codex_rpc_error:${parsed.error.code ?? "unknown"}`));
      return;
    }
    waiter.resolve(parsed.result);
  };
  socket.addEventListener("message", onMessage);

  const sendRequest = async (requestMethod: string, requestParams: unknown): Promise<unknown> => {
    const id = nextId++;
    const result = new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`codex_rpc_timeout:${requestMethod}`));
      }, 15000);
      pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
    });
    socket.send(JSON.stringify({ id, method: requestMethod, params: requestParams }));
    return result;
  };

  try {
    await sendRequest("initialize", {
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
    return await sendRequest(method, params);
  } finally {
    socket.removeEventListener?.("message", onMessage);
    socket.close();
  }
}

function extractTurnResponseText(turn: CodexTurn | undefined): string | undefined {
  const agentItems = [...(turn?.items ?? [])].filter((item) => item.type === "agentMessage");
  for (const item of agentItems.reverse()) {
    const directText = item.text?.trim();
    if (directText) return directText;
    const contentText = item.content
      ?.map((part) => part.text)
      .filter((text): text is string => Boolean(text?.trim()))
      .join("\n")
      .trim();
    if (contentText) return contentText;
  }
  return undefined;
}

function assertLocalCodexAppServerUrl(appServerUrl: string): void {
  if (!appServerUrl) throw new Error("codex_app_server_url_missing");
  if (!appServerUrl.startsWith("ws://127.0.0.1") && !appServerUrl.startsWith("ws://localhost")) {
    throw new Error("codex_app_server_url_must_be_local");
  }
}
