/**
 * Telegram Bot API edge helpers for the local gateway.
 *
 * Inputs: bot token, chat ids, Telegram update offsets, and outbound text.
 * Outputs: Bot API results plus updated local reply mappings.
 * Side effects: network calls to Telegram and optional local state writes.
 */

import { readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { appendHistory, loadGatewayState, mergeGatewayState, recordOutboundMapping, saveGatewayState } from "./state";
import type {
  TelegramApiResponse,
  TelegramDocumentResult,
  TelegramGatewayState,
  TelegramSendMessageResult,
  TelegramSourceContext,
  TelegramUpdate,
} from "./types";

const TELEGRAM_MESSAGE_LIMIT = 4096;
const TELEGRAM_SAFE_MESSAGE_LIMIT = 3900;
const TELEGRAM_CAPTION_LIMIT = 1024;
const TELEGRAM_DOCUMENT_LIMIT_BYTES = 50 * 1024 * 1024;

export async function sendTelegramNotification(input: {
  token: string;
  chatId: string;
  text: string;
  threadId: string;
  sessionId?: string;
  state: TelegramGatewayState;
  statePath?: string;
  title?: string;
  parseMode?: "Markdown" | "MarkdownV2" | "HTML" | "none";
  disableWebPagePreview?: boolean;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: boolean; state: TelegramGatewayState; messageId?: number; error?: string }> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const formatted = formatTelegramGatewayMessage({
    text: input.text,
    threadId: input.threadId,
    sessionId: input.sessionId,
    title: input.title,
  });
  try {
    const result = await telegramApi<TelegramSendMessageResult>(
      input.token,
      "sendMessage",
      {
        chat_id: input.chatId,
        text: formatted.text,
        disable_web_page_preview: input.disableWebPagePreview ?? true,
        ...(input.parseMode && input.parseMode !== "none" ? { parse_mode: input.parseMode } : {}),
      },
      fetchImpl,
    );
    const messageId = result.message_id;
    const baseState = input.statePath ? mergeGatewayState(input.state, await loadGatewayState(input.statePath)) : input.state;
    let nextState = recordOutboundMapping(baseState, {
      telegramMessageId: messageId,
      chatId: input.chatId,
      threadId: input.threadId,
      sessionId: input.sessionId,
      title: input.title,
    });
    nextState = appendHistory(nextState, {
      telegramMessageId: messageId,
      chatId: input.chatId,
      direction: "outbound",
      text: formatted.text,
      route: "source_thread",
      threadId: input.threadId,
    });
    if (input.statePath) await saveGatewayState(nextState, input.statePath);
    return { ok: true, state: nextState, messageId };
  } catch (error) {
    return { ok: false, state: input.state, error: error instanceof Error ? error.message : "telegram_send_failed" };
  }
}

export async function fetchTelegramUpdates(input: {
  token: string;
  offset: number;
  timeoutSeconds?: number;
  fetchImpl?: typeof fetch;
}): Promise<TelegramUpdate[]> {
  const url = new URL(`https://api.telegram.org/bot${input.token}/getUpdates`);
  if (input.offset > 0) url.searchParams.set("offset", String(input.offset));
  url.searchParams.set("timeout", String(input.timeoutSeconds ?? 20));
  url.searchParams.set("allowed_updates", JSON.stringify(["message"]));

  const response = await (input.fetchImpl ?? fetch)(url);
  const body = (await response.json()) as TelegramApiResponse<TelegramUpdate[]>;
  if (!response.ok || !body.ok || body.result === undefined) {
    throw new Error(body.description ?? `telegram_getUpdates_failed:${response.status}`);
  }
  return body.result;
}

export async function sendTelegramReply(input: {
  token: string;
  chatId: string;
  replyToMessageId: number;
  text: string;
  source?: TelegramSourceContext;
  parseMode?: "Markdown" | "MarkdownV2" | "HTML" | "none";
  fetchImpl?: typeof fetch;
}): Promise<{ ok: boolean; messageId?: number; error?: string }> {
  const formatted = input.source
    ? formatTelegramGatewayMessage({ text: input.text, ...input.source })
    : { text: truncateTelegramMessage(input.text) };
  try {
    const result = await telegramApi<TelegramSendMessageResult>(
      input.token,
      "sendMessage",
      {
        chat_id: input.chatId,
        text: formatted.text,
        reply_parameters: { message_id: input.replyToMessageId },
        disable_web_page_preview: true,
        ...(input.parseMode && input.parseMode !== "none" ? { parse_mode: input.parseMode } : {}),
      },
      input.fetchImpl ?? fetch,
    );
    return { ok: true, messageId: result.message_id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "telegram_reply_failed" };
  }
}

export async function sendTelegramDocument(input: {
  token: string;
  chatId: string;
  filePath: string;
  state: TelegramGatewayState;
  threadId: string;
  sessionId?: string;
  title?: string;
  caption?: string;
  replyToMessageId?: number;
  statePath?: string;
  allowedRoots?: string[];
  fetchImpl?: typeof fetch;
}): Promise<{ ok: boolean; state: TelegramGatewayState; messageId?: number; error?: string }> {
  try {
    const artifact = await validateTelegramArtifactPath(input.filePath, input.allowedRoots);
    const caption = formatTelegramGatewayCaption({
      text: input.caption ?? artifact.fileName,
      threadId: input.threadId,
      sessionId: input.sessionId,
      title: input.title,
    });
    const body = new FormData();
    body.set("chat_id", input.chatId);
    body.set("caption", caption);
    body.set("disable_content_type_detection", "false");
    if (input.replyToMessageId) {
      body.set("reply_parameters", JSON.stringify({ message_id: input.replyToMessageId }));
    }
    body.set("document", new Blob([await readFile(artifact.filePath)]), artifact.fileName);

    const response = await (input.fetchImpl ?? fetch)(`https://api.telegram.org/bot${input.token}/sendDocument`, {
      method: "POST",
      body,
    });
    const resultBody = (await response.json()) as TelegramApiResponse<TelegramDocumentResult>;
    if (!response.ok || !resultBody.ok || resultBody.result === undefined) {
      throw new Error(resultBody.description ?? `telegram_sendDocument_failed:${response.status}`);
    }
    const messageId = resultBody.result.message_id;
    const baseState = input.statePath ? mergeGatewayState(input.state, await loadGatewayState(input.statePath)) : input.state;
    let nextState = recordOutboundMapping(baseState, {
      telegramMessageId: messageId,
      chatId: input.chatId,
      threadId: input.threadId,
      sessionId: input.sessionId,
      title: input.title,
    });
    nextState = appendHistory(nextState, {
      telegramMessageId: messageId,
      chatId: input.chatId,
      direction: "outbound",
      text: caption,
      route: "source_thread",
      threadId: input.threadId,
    });
    if (input.statePath) await saveGatewayState(nextState, input.statePath);
    return { ok: true, state: nextState, messageId };
  } catch (error) {
    return { ok: false, state: input.state, error: error instanceof Error ? error.message : "telegram_document_failed" };
  }
}

export async function telegramApi<T>(
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

export function formatTelegramGatewayMessage(input: { text: string } & TelegramSourceContext): { text: string } {
  const footer = buildSourceFooter(input);
  return { text: truncateTelegramMessageWithFooter(input.text, footer, TELEGRAM_SAFE_MESSAGE_LIMIT) };
}

export function formatTelegramGatewayCaption(input: { text: string } & TelegramSourceContext): string {
  const footer = buildSourceFooter(input);
  return truncateTelegramMessageWithFooter(input.text, footer, TELEGRAM_CAPTION_LIMIT);
}

export async function validateTelegramArtifactPath(
  filePath: string,
  allowedRoots = defaultTelegramArtifactRoots(),
): Promise<{ filePath: string; fileName: string; size: number }> {
  const resolvedPath = path.resolve(filePath);
  const roots = allowedRoots.map((root) => path.resolve(root));
  if (!roots.some((root) => isPathInsideRoot(resolvedPath, root))) {
    throw new Error(`telegram_artifact_outside_allowed_roots:${resolvedPath}`);
  }
  const info = await stat(resolvedPath);
  if (!info.isFile()) throw new Error(`telegram_artifact_not_file:${resolvedPath}`);
  if (info.size > TELEGRAM_DOCUMENT_LIMIT_BYTES) {
    throw new Error(`telegram_artifact_too_large:${info.size}`);
  }
  return { filePath: resolvedPath, fileName: path.basename(resolvedPath), size: info.size };
}

function defaultTelegramArtifactRoots(): string[] {
  return [process.cwd(), path.join(os.homedir(), ".farplane")];
}

function isPathInsideRoot(filePath: string, root: string): boolean {
  const relative = path.relative(root, filePath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function buildSourceFooter(input: TelegramSourceContext): string {
  return [
    "---",
    `Codex: ${input.title?.trim() || "Telegram gateway response"}`,
    `Thread: ${input.threadId}`,
    input.sessionId?.trim() && input.sessionId !== input.threadId ? `Session: ${input.sessionId}` : "",
  ].filter(Boolean).join("\n");
}

function truncateTelegramMessage(text: string): string {
  return text.length > TELEGRAM_SAFE_MESSAGE_LIMIT ? `${text.slice(0, TELEGRAM_SAFE_MESSAGE_LIMIT - 10)}\n...[truncated]` : text;
}

function truncateTelegramMessageWithFooter(text: string, footer: string, limit: number): string {
  const normalizedText = text.trimEnd();
  const suffix = `\n\n${footer}`;
  if (`${normalizedText}${suffix}`.length <= limit) return `${normalizedText}${suffix}`;
  const available = Math.max(0, limit - suffix.length - "\n...[truncated]".length);
  return `${normalizedText.slice(0, available)}\n...[truncated]${suffix}`;
}
