/**
 * Routing and prompt-shaping rules for Telegram-originated messages.
 *
 * Inputs: Telegram updates plus local gateway state/config.
 * Outputs: route decisions and Codex prompt text.
 * Side effects: none.
 */

import type {
  TelegramGatewayConfig,
  TelegramGatewayMapping,
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

export function buildSourceThreadPrompt(input: {
  text: string;
  telegramMessageId: number;
  replyToMessageId?: number;
}): string {
  return [
    "# Telegram Message",
    "Kenji is messaging from Telegram.",
    `Telegram message id: ${input.telegramMessageId}`,
    input.replyToMessageId ? `Replying to Telegram notification: ${input.replyToMessageId}` : "",
    "",
    "# User Message",
    input.text,
    "",
    "# Response Routing",
    "Answer normally in this Codex thread. The local Telegram gateway will send your assistant response back as a Telegram reply to Kenji's Telegram message. Do not send a separate Telegram notification for this same response.",
  ].filter((line) => line !== "").join("\n");
}

export function buildCoordinatorPrompt(text: string, state: TelegramGatewayState): string {
  const recentMessages = state.history
    .slice(0, 12)
    .reverse()
    .map((entry) => `- ${entry.direction} ${entry.route ?? "unrouted"}: ${entry.text}`)
    .join("\n");
  const recentNotifications = state.mappings
    .slice(0, 10)
    .map((mapping: TelegramGatewayMapping) => `- msg ${mapping.telegramMessageId}: ${mapping.title ?? "Untitled"} -> ${mapping.threadId}`)
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

export function isRetryableCodexDeliveryError(error: string | undefined): boolean {
  return (
    error === "fetch failed" ||
    error === "codex_app_server_unreachable" ||
    error === "codex_app_server_open_timeout" ||
    error === "codex_app_server_url_missing" ||
    Boolean(error?.startsWith("codex_rpc_timeout:"))
  );
}

function parseSourceThreadId(text: string): string | undefined {
  const match = text.match(/Source thread:\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  return match?.[1];
}
