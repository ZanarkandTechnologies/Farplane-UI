/**
 * Local Telegram reply gateway for Farplane user communications.
 *
 * Inputs: Telegram Bot API updates, local mapping state, and the Vite Codex
 * app-server RPC bridge.
 * Outputs: routed Codex turns plus local Telegram reply mappings.
 * Side effects: reads/writes ~/.farplane/telegram-gateway unless overridden.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);

export type TelegramGatewayMapping = {
  telegramMessageId: number;
  chatId: string;
  threadId: string;
  sessionId?: string;
  title?: string;
  createdAt: number;
};

export type TelegramGatewayHistoryEntry = {
  telegramMessageId: number;
  chatId: string;
  direction: "inbound" | "outbound";
  text: string;
  occurredAt: number;
  route?: "source_thread" | "coordinator" | "unknown_reply";
  threadId?: string;
};

export type TelegramGatewayState = {
  updateOffset: number;
  mappings: TelegramGatewayMapping[];
  history: TelegramGatewayHistoryEntry[];
};

export type TelegramGatewayConfig = {
  allowedChatIds: string[];
  coordinatorThreadId?: string;
};

export type TelegramGatewayFileConfig = {
  version?: number;
  mainThreadId?: string;
  stateBase?: string;
  runtime?: {
    aiOfficeUrl?: string;
    stateBase?: string;
    codexAppServerUrl?: string;
  };
  telegram?: {
    enabled?: boolean;
    dmPolicy?: "allowlist";
    botToken?: string;
    allowFrom?: string[];
    mainThreadId?: string;
    groupPolicy?: "allowlist";
    streaming?: {
      mode?: "off";
    };
  };
};

export type ResolvedTelegramGatewayConfig = TelegramGatewayConfig & {
  botToken: string;
  enabled: boolean;
  stateBase: string;
};

export type TelegramApiResponse<T> = {
  ok: boolean;
  result?: T;
  description?: string;
};

export type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    chat?: { id?: number | string };
    text?: string;
    date?: number;
    reply_to_message?: {
      message_id?: number;
    };
  };
};

export type TelegramSendMessageResult = {
  message_id: number;
  chat?: { id?: number | string };
  text?: string;
};

export type TelegramRouteDecision =
  | { kind: "ignore"; reason: string }
  | { kind: "source_thread"; threadId: string; text: string; mapping: TelegramGatewayMapping }
  | { kind: "coordinator"; threadId: string; text: string; prompt: string }
  | { kind: "unknown_reply"; text: string; replyToMessageId: number };

export function emptyGatewayState(): TelegramGatewayState {
  return { updateOffset: 0, mappings: [], history: [] };
}

export function resolveTelegramRoute(
  update: TelegramUpdate,
  state: TelegramGatewayState,
  config: TelegramGatewayConfig,
): TelegramRouteDecision {
  const message = update.message;
  const chatId = String(message?.chat?.id ?? "");
  const text = message?.text?.trim() ?? "";
  if (!message || !chatId || !config.allowedChatIds.includes(chatId)) {
    return { kind: "ignore", reason: "not_owner_chat" };
  }
  if (!text || text.startsWith("/")) return { kind: "ignore", reason: "empty_or_command" };

  const replyToMessageId = message.reply_to_message?.message_id;
  if (typeof replyToMessageId === "number") {
    const mapping = state.mappings.find(
      (candidate) =>
        candidate.telegramMessageId === replyToMessageId && candidate.chatId === chatId,
    );
    if (!mapping) return { kind: "unknown_reply", text, replyToMessageId };
    return { kind: "source_thread", threadId: mapping.threadId, text, mapping };
  }

  if (!config.coordinatorThreadId?.trim()) {
    return { kind: "ignore", reason: "missing_coordinator_thread" };
  }

  return {
    kind: "coordinator",
    threadId: config.coordinatorThreadId.trim(),
    text,
    prompt: buildCoordinatorPrompt(text, state),
  };
}

export function recordOutboundMapping(
  state: TelegramGatewayState,
  mapping: Omit<TelegramGatewayMapping, "createdAt"> & { createdAt?: number },
): TelegramGatewayState {
  const createdAt = mapping.createdAt ?? Date.now();
  const nextMappings = state.mappings.filter(
    (candidate) =>
      !(candidate.telegramMessageId === mapping.telegramMessageId && candidate.chatId === mapping.chatId),
  );
  nextMappings.unshift({ ...mapping, createdAt });
  return {
    ...state,
    mappings: nextMappings.slice(0, 500),
  };
}

export function appendHistory(
  state: TelegramGatewayState,
  entry: Omit<TelegramGatewayHistoryEntry, "occurredAt"> & { occurredAt?: number },
): TelegramGatewayState {
  return {
    ...state,
    history: [{ ...entry, occurredAt: entry.occurredAt ?? Date.now() }, ...state.history].slice(0, 200),
  };
}

export function buildCoordinatorPrompt(text: string, state: TelegramGatewayState): string {
  const recentMessages = state.history
    .slice(0, 12)
    .reverse()
    .map((entry) => `- ${entry.direction} ${entry.route ?? "unrouted"}: ${entry.text}`)
    .join("\n");
  const recentNotifications = state.mappings
    .slice(0, 10)
    .map((mapping) => `- msg ${mapping.telegramMessageId}: ${mapping.title ?? "Untitled"} -> ${mapping.threadId}`)
    .join("\n");

  return [
    "# Telegram Coordinator Message",
    text,
    "",
    "# Recent Telegram History",
    recentMessages || "- none",
    "",
    "# Recent Notification Map",
    recentNotifications || "- none",
    "",
    "# Instructions",
    "Decide whether to answer directly, ask a clarifying question, or tell Kenji which notification to reply to. Do not route to a source thread unless the intended target is explicit.",
  ].join("\n");
}

export async function sendTelegramNotification(input: {
  token: string;
  chatId: string;
  text: string;
  threadId: string;
  state: TelegramGatewayState;
  statePath?: string;
  title?: string;
  parseMode?: "Markdown" | "MarkdownV2" | "HTML" | "none";
  disableWebPagePreview?: boolean;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: boolean; state: TelegramGatewayState; messageId?: number; error?: string }> {
  const fetchImpl = input.fetchImpl ?? fetch;
  try {
    const result = await telegramApi<TelegramSendMessageResult>(
      input.token,
      "sendMessage",
      {
        chat_id: input.chatId,
        text: input.text,
        disable_web_page_preview: input.disableWebPagePreview ?? true,
        ...(input.parseMode && input.parseMode !== "none" ? { parse_mode: input.parseMode } : {}),
      },
      fetchImpl,
    );
    const messageId = result.message_id;
    let nextState = recordOutboundMapping(input.state, {
      telegramMessageId: messageId,
      chatId: input.chatId,
      threadId: input.threadId,
      title: input.title,
    });
    nextState = appendHistory(nextState, {
      telegramMessageId: messageId,
      chatId: input.chatId,
      direction: "outbound",
      text: input.text,
      route: "source_thread",
      threadId: input.threadId,
    });
    if (input.statePath) await saveGatewayState(nextState, input.statePath);
    return { ok: true, state: nextState, messageId };
  } catch (error) {
    return { ok: false, state: input.state, error: error instanceof Error ? error.message : "telegram_send_failed" };
  }
}

export async function sendCodexMessage(input: {
  stateBase: string;
  threadId: string;
  text: string;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: boolean; turnId?: string; error?: string }> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const stateBase = input.stateBase.replace(/\/+$/, "");
  const rpc = async <T>(method: string, params: Record<string, unknown>): Promise<T> => {
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

  try {
    const read = await rpc<{ thread?: { turns?: Array<{ id: string; status?: string; completedAt?: number | null }> } }>(
      "thread/read",
      { threadId: input.threadId, includeTurns: true },
    );
    const activeTurn = [...(read.thread?.turns ?? [])].reverse().find((turn) => {
      const status = turn.status?.toLowerCase() ?? "";
      return !turn.completedAt && status !== "completed" && status !== "failed" && status !== "cancelled";
    });
    const params = {
      threadId: input.threadId,
      input: [{ type: "text", text: input.text, text_elements: [] }],
      ...(activeTurn ? { expectedTurnId: activeTurn.id } : {}),
    };
    const result = await rpc<{ turn?: { id?: string } }>(
      activeTurn ? "turn/steer" : "turn/start",
      params,
    );
    return { ok: true, turnId: result.turn?.id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "codex_send_failed" };
  }
}

export async function fetchTelegramUpdates(input: {
  token: string;
  offset: number;
  timeoutSeconds?: number;
  fetchImpl?: typeof fetch;
}): Promise<TelegramUpdate[]> {
  const result = await telegramApi<TelegramUpdate[]>(
    input.token,
    "getUpdates",
    {
      offset: input.offset || undefined,
      timeout: input.timeoutSeconds ?? 20,
      allowed_updates: ["message"],
    },
    input.fetchImpl ?? fetch,
  );
  return result;
}

export async function processTelegramUpdate(input: {
  update: TelegramUpdate;
  state: TelegramGatewayState;
  config: TelegramGatewayConfig;
  stateBase: string;
  dryRun?: boolean;
  fetchImpl?: typeof fetch;
}): Promise<{ state: TelegramGatewayState; route: TelegramRouteDecision; delivered: boolean; error?: string }> {
  const route = resolveTelegramRoute(input.update, input.state, input.config);
  const message = input.update.message;
  let nextState = { ...input.state, updateOffset: Math.max(input.state.updateOffset, input.update.update_id + 1) };
  if (route.kind === "ignore") return { state: nextState, route, delivered: false };

  const historyBase = {
    telegramMessageId: message?.message_id ?? 0,
    chatId: String(message?.chat?.id ?? input.config.allowedChatIds[0] ?? ""),
    direction: "inbound" as const,
    text: route.kind === "coordinator" ? route.text : route.kind === "source_thread" ? route.text : route.text,
  };

  if (route.kind === "unknown_reply") {
    nextState = appendHistory(nextState, { ...historyBase, route: "unknown_reply" });
    return { state: nextState, route, delivered: false, error: `unknown_reply:${route.replyToMessageId}` };
  }

  const text = route.kind === "coordinator" ? route.prompt : route.text;
  if (!input.dryRun) {
    const sent = await sendCodexMessage({
      stateBase: input.stateBase,
      threadId: route.threadId,
      text,
      fetchImpl: input.fetchImpl,
    });
    if (!sent.ok) return { state: nextState, route, delivered: false, error: sent.error };
  }

  nextState = appendHistory(nextState, {
    ...historyBase,
    route: route.kind,
    threadId: route.threadId,
  });
  return { state: nextState, route, delivered: true };
}

export async function loadGatewayState(statePath = defaultStatePath()): Promise<TelegramGatewayState> {
  try {
    const raw = await readFile(statePath, "utf8");
    const parsed = JSON.parse(raw) as TelegramGatewayState;
    return {
      updateOffset: Number.isFinite(parsed.updateOffset) ? parsed.updateOffset : 0,
      mappings: Array.isArray(parsed.mappings) ? parsed.mappings : [],
      history: Array.isArray(parsed.history) ? parsed.history : [],
    };
  } catch {
    return emptyGatewayState();
  }
}

export async function saveGatewayState(
  state: TelegramGatewayState,
  statePath = defaultStatePath(),
): Promise<void> {
  await mkdir(path.dirname(statePath), { recursive: true });
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

export function defaultStatePath(): string {
  const root = process.env.FARPLANE_STATE_DIR?.trim() || path.join(os.homedir(), ".farplane");
  return path.join(root, "telegram-gateway", "state.json");
}

export function defaultConfigPath(): string {
  const root = process.env.FARPLANE_STATE_DIR?.trim() || path.join(os.homedir(), ".farplane");
  return path.join(root, "config.json");
}

export async function loadGatewayFileConfig(configPath = defaultConfigPath()): Promise<TelegramGatewayFileConfig> {
  try {
    const raw = await readFile(configPath, "utf8");
    const parsed = JSON.parse(raw) as TelegramGatewayFileConfig;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function telegramApi<T>(
  token: string,
  method: string,
  payload: Record<string, unknown>,
  fetchImpl: typeof fetch,
): Promise<T> {
  const response = await fetchImpl(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await response.json()) as TelegramApiResponse<T>;
  if (!response.ok || !body.ok || body.result === undefined) {
    throw new Error(body.description ?? `telegram_${method}_failed:${response.status}`);
  }
  return body.result;
}

async function readTelegramToken(): Promise<string | null> {
  const envToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (envToken) return envToken;
  try {
    const { stdout } = await execFileAsync("security", [
      "find-generic-password",
      "-a",
      process.env.USER ?? "",
      "-s",
      "codex-telegram-bot-token",
      "-w",
    ]);
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

function parseList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

async function resolveGatewayConfig(): Promise<ResolvedTelegramGatewayConfig> {
  const fileConfig = await loadGatewayFileConfig();
  const envAllowFrom = parseList(process.env.TELEGRAM_ALLOW_FROM);
  const legacyChatId = process.env.TELEGRAM_CHAT_ID?.trim();
  const allowedChatIds =
    envAllowFrom.length > 0
      ? envAllowFrom
      : legacyChatId
        ? [legacyChatId]
        : (fileConfig.telegram?.allowFrom ?? []).map(String).map((entry) => entry.trim()).filter(Boolean);
  const envToken = await readTelegramToken();
  return {
    enabled: fileConfig.telegram?.enabled !== false,
    botToken: envToken ?? fileConfig.telegram?.botToken?.trim() ?? "",
    allowedChatIds,
    coordinatorThreadId:
      process.env.TELEGRAM_COORDINATOR_THREAD_ID?.trim() ||
      fileConfig.telegram?.mainThreadId?.trim() ||
      fileConfig.mainThreadId?.trim() ||
      undefined,
    stateBase:
      process.env.FARPLANE_STATE_BASE?.trim() ||
      process.env.VITE_STATE_URL?.trim() ||
      fileConfig.runtime?.aiOfficeUrl?.trim() ||
      fileConfig.runtime?.stateBase?.trim() ||
      fileConfig.stateBase?.trim() ||
      "http://127.0.0.1:5173",
  };
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  if (args.has("--help")) {
    console.log("Usage: npm run cli -- gateway telegram [--once] [--dry-run] [--check-config]");
    return;
  }
  const statePath = defaultStatePath();
  let state = await loadGatewayState(statePath);
  const config = await resolveGatewayConfig();
  const dryRun = args.has("--dry-run");
  if (args.has("--check-config")) {
    console.log(
      JSON.stringify({
        ok: config.enabled && Boolean(config.botToken) && config.allowedChatIds.length > 0,
        enabled: config.enabled,
        hasBotToken: Boolean(config.botToken),
        allowedChatIds: config.allowedChatIds.length,
        hasCoordinatorThread: Boolean(config.coordinatorThreadId),
        stateBase: config.stateBase,
        configPath: defaultConfigPath(),
        statePath,
      }),
    );
    return;
  }
  if (!config.enabled) {
    console.log(
      JSON.stringify({
        ok: false,
        error: "telegram_gateway_disabled",
        configPath: defaultConfigPath(),
      }),
    );
    return;
  }
  if (!config.botToken || config.allowedChatIds.length === 0) {
    console.log(
      JSON.stringify({
        ok: false,
        error: "missing_telegram_config",
        needs: ["telegram.botToken", "telegram.allowFrom"],
        statePath,
        configPath: defaultConfigPath(),
      }),
    );
    return;
  }

  do {
    const updates = await fetchTelegramUpdates({ token: config.botToken, offset: state.updateOffset, timeoutSeconds: args.has("--once") ? 0 : 20 });
    const results = [];
    for (const update of updates) {
      const result = await processTelegramUpdate({ update, state, config, stateBase: config.stateBase, dryRun });
      state = result.state;
      results.push({
        updateId: update.update_id,
        route: result.route.kind,
        delivered: result.delivered,
        error: result.error,
      });
    }
    await saveGatewayState(state, statePath);
    console.log(
      JSON.stringify({
        ok: true,
        dryRun,
        statePath,
        updates: updates.length,
        results,
        nextOffset: state.updateOffset,
      }),
    );
  } while (!args.has("--once"));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
