/**
 * Routing and prompt-shaping rules for Telegram-originated messages.
 *
 * Inputs: Telegram updates plus local gateway state/config.
 * Outputs: route decisions and Codex prompt text.
 * Side effects: none.
 */

import type {
  TelegramGatewayConfig,
  TelegramGatewayState,
  TelegramRouteDecision,
  TelegramUpdate,
} from "./types";

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
    const fallbackThreadId = parseSourceThreadId(
      `${message.reply_to_message?.text ?? ""}\n${message.reply_to_message?.caption ?? ""}`,
    );
    if (!mapping && fallbackThreadId) {
      return {
        kind: "source_thread",
        threadId: fallbackThreadId,
        text,
        mapping: {
          telegramMessageId: replyToMessageId,
          chatId,
          threadId: fallbackThreadId,
          createdAt: Date.now(),
          title: "Recovered from Telegram reply context",
        },
      };
    }
    if (!mapping) return { kind: "unknown_reply", text, replyToMessageId };
    return { kind: "source_thread", threadId: mapping.threadId, text, mapping };
  }

  if (!config.defaultThreadId) return { kind: "ignore", reason: "default_thread_missing" };
  return {
    kind: "coordinator",
    threadId: config.defaultThreadId,
    text,
    prompt: buildCoordinatorPrompt(text, state),
  };
}

export function buildSourceThreadPrompt(input: {
  text: string;
  telegramMessageId: number;
  replyToMessageId?: number;
}): string {
  void input.telegramMessageId;
  void input.replyToMessageId;
  return input.text;
}

export function buildCoordinatorPrompt(text: string, state: TelegramGatewayState): string {
  void state;
  return text;
}

export function isRetryableCodexDeliveryError(error: string | undefined): boolean {
  return (
    error === "fetch failed" ||
    error === "codex_app_server_unreachable" ||
    error === "codex_app_server_open_timeout" ||
    error === "codex_app_server_url_missing" ||
    Boolean(error?.startsWith("failed to read thread:")) ||
    Boolean(error?.includes("thread-store internal error")) ||
    Boolean(error?.toLowerCase().includes("operation was aborted")) ||
    Boolean(error?.toLowerCase().includes("aborterror")) ||
    Boolean(error?.startsWith("codex_rpc_timeout:"))
  );
}

export function isTerminalCodexDeliveryError(error: string | undefined): boolean {
  const normalized = error?.toLowerCase() ?? "";
  return (
    normalized.includes("ran out of room in the model's context window") ||
    normalized.includes("is archived") ||
    normalized.includes("thread/resume failed")
  );
}

function parseSourceThreadId(text: string): string | undefined {
  const match = text.match(/(?:Source thread|Thread):\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  return match?.[1];
}
