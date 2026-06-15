/**
 * Telegram Bot API edge helpers for the local gateway.
 *
 * Inputs: bot token, chat ids, Telegram update offsets, and outbound text.
 * Outputs: Bot API results plus updated local reply mappings.
 * Side effects: network calls to Telegram and optional local state writes.
 */

import { appendHistory, recordOutboundMapping, saveGatewayState } from "./state";
import type {
  TelegramApiResponse,
  TelegramGatewayState,
  TelegramSendMessageResult,
  TelegramUpdate,
} from "./types";

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

export async function sendTelegramReply(input: {
  token: string;
  chatId: string;
  replyToMessageId: number;
  text: string;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: boolean; messageId?: number; error?: string }> {
  try {
    const result = await telegramApi<TelegramSendMessageResult>(
      input.token,
      "sendMessage",
      {
        chat_id: input.chatId,
        text: truncateTelegramMessage(input.text),
        reply_parameters: { message_id: input.replyToMessageId },
        disable_web_page_preview: true,
      },
      input.fetchImpl ?? fetch,
    );
    return { ok: true, messageId: result.message_id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "telegram_reply_failed" };
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

function truncateTelegramMessage(text: string): string {
  return text.length > 3900 ? `${text.slice(0, 3890)}\n...[truncated]` : text;
}
