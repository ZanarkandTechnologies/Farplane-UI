/**
 * Telegram update processor for source-thread and coordinator routing.
 *
 * Inputs: Telegram updates, resolved config, local gateway state, and Codex
 * delivery options.
 * Outputs: updated gateway state plus delivery/reply result summaries.
 * Side effects: sends Codex turns and Telegram replies through edge helpers.
 */

import { sendCodexMessage } from "./codex-exec";
import {
  buildSourceThreadPrompt,
  isRetryableCodexDeliveryError,
  isTerminalCodexDeliveryError,
  resolveTelegramRoute,
} from "./routing";
import {
  appendHistory,
  queuePendingMessage,
  recordOutboundMapping,
  removePendingMessage,
  updatePendingMessage,
} from "./state";
import { formatTelegramGatewayMessage, sendTelegramReply } from "./telegram-api";
import type {
  TelegramGatewayConfig,
  TelegramGatewayState,
  TelegramRouteDecision,
  TelegramSourceContext,
  TelegramUpdate,
} from "./types";

type CodexDeliveryImpl = (input: {
  threadId: string;
  text: string;
  responseTimeoutMs?: number;
}) => Promise<{ turnId?: string; responseText?: string }>;

export async function processTelegramUpdate(input: {
  update: TelegramUpdate;
  state: TelegramGatewayState;
  config: TelegramGatewayConfig;
  dryRun?: boolean;
  fetchImpl?: typeof fetch;
  codexImpl?: CodexDeliveryImpl;
}): Promise<{ state: TelegramGatewayState; route: TelegramRouteDecision; delivered: boolean; telegramReplied?: boolean; error?: string }> {
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

  const promptText = route.kind === "coordinator"
    ? route.prompt
    : buildSourceThreadPrompt({
        text: route.text,
        telegramMessageId: historyBase.telegramMessageId,
        replyToMessageId: message?.reply_to_message?.message_id,
      });
  if (!input.dryRun) {
    const sent = await sendCodexMessage({
      threadId: route.threadId,
      text: promptText,
      responseTimeoutMs: input.config.responseTimeoutMs,
      codexImpl: input.codexImpl,
    });
    if (!sent.ok) {
      if (isRetryableCodexDeliveryError(sent.error)) {
        const source = sourceContextForRoute(route);
        nextState = queuePendingMessage(nextState, {
          telegramMessageId: historyBase.telegramMessageId,
          chatId: historyBase.chatId,
          text: route.text,
          promptText,
          route: route.kind,
          threadId: route.threadId,
          sessionId: source.sessionId,
          title: source.title,
          lastError: sent.error,
          lastAttemptAt: Date.now(),
        });
        nextState = appendHistory(nextState, {
          ...historyBase,
          route: route.kind,
          threadId: route.threadId,
          status: "queued",
          turnId: sent.turnId,
          error: sent.error,
        });
        return {
          state: nextState,
          route,
          delivered: false,
          telegramReplied: false,
          error: "queued_delivery_retry",
        };
      }
      const source = sourceContextForRoute(route);
      nextState = appendHistory(nextState, {
        ...historyBase,
        route: route.kind,
        threadId: route.threadId,
        status: "failed",
        error: sent.error,
      });
      if (isTerminalCodexDeliveryError(sent.error) && input.config.botToken && message?.message_id) {
        await sendTelegramReply({
          token: input.config.botToken,
          chatId: historyBase.chatId,
          replyToMessageId: message.message_id,
          text: buildDeliveryFailureReply(sent.error),
          source,
          fetchImpl: input.fetchImpl,
        });
      }
      return { state: nextState, route, delivered: false, error: sent.error };
    }
    if (sent.responseText && input.config.botToken && message?.message_id) {
      const source = sourceContextForRoute(route);
      const formatted = formatTelegramGatewayMessage({ text: sent.responseText, ...source }).text;
      const telegramReply = await sendTelegramReply({
        token: input.config.botToken,
        chatId: historyBase.chatId,
        replyToMessageId: message.message_id,
        text: sent.responseText,
        source,
        fetchImpl: input.fetchImpl,
      });
      if (telegramReply.ok && telegramReply.messageId) {
        nextState = recordOutboundMapping(nextState, {
          telegramMessageId: telegramReply.messageId,
          chatId: historyBase.chatId,
          threadId: route.threadId,
          sessionId: source.sessionId,
          title: source.title,
        });
        nextState = appendHistory(nextState, {
          telegramMessageId: telegramReply.messageId,
          chatId: historyBase.chatId,
          direction: "outbound",
          text: formatted,
          route: route.kind,
          threadId: route.threadId,
          status: "delivered",
          telegramReplyToMessageId: message.message_id,
        });
      }
      if (!telegramReply.ok) {
        nextState = appendHistory(nextState, {
          ...historyBase,
          route: route.kind,
          threadId: route.threadId,
          status: "failed",
          turnId: sent.turnId,
          error: telegramReply.error,
        });
        return { state: nextState, route, delivered: true, telegramReplied: false, error: telegramReply.error };
      }
      nextState = appendHistory(nextState, {
        ...historyBase,
        route: route.kind,
        threadId: route.threadId,
        status: "delivered",
        turnId: sent.turnId,
      });
      return { state: nextState, route, delivered: true, telegramReplied: true };
    }
  }

  nextState = appendHistory(nextState, {
    ...historyBase,
    route: route.kind,
    threadId: route.threadId,
    status: input.dryRun ? "queued" : "delivered",
  });
  return { state: nextState, route, delivered: true };
}

export async function processPendingMessages(input: {
  state: TelegramGatewayState;
  config: TelegramGatewayConfig;
  dryRun?: boolean;
  fetchImpl?: typeof fetch;
  codexImpl?: CodexDeliveryImpl;
}): Promise<{ state: TelegramGatewayState; processed: number; replied: number; queued: number; failed: number }> {
  let nextState = input.state;
  let processed = 0;
  let replied = 0;
  let queued = 0;
  let failed = 0;
  for (const pending of input.state.pending) {
    if (input.dryRun) {
      queued += 1;
      continue;
    }
    const sent = await sendCodexMessage({
      threadId: pending.threadId,
      text: pending.promptText ?? pending.text,
      responseTimeoutMs: input.config.responseTimeoutMs,
      codexImpl: input.codexImpl,
    });
    if (!sent.ok && isRetryableCodexDeliveryError(sent.error)) {
      queued += 1;
      nextState = updatePendingMessage(nextState, pending, {
        attempts: pending.attempts + 1,
        lastAttemptAt: Date.now(),
        lastError: sent.error,
      });
      continue;
    }
    if (!sent.ok) {
      failed += 1;
      nextState = isTerminalCodexDeliveryError(sent.error)
        ? removePendingMessage(nextState, pending)
        : updatePendingMessage(nextState, pending, {
            attempts: pending.attempts + 1,
            lastAttemptAt: Date.now(),
            lastError: sent.error,
          });
      nextState = appendHistory(nextState, {
        telegramMessageId: pending.telegramMessageId,
        chatId: pending.chatId,
        direction: "inbound",
        text: pending.text,
        route: pending.route,
        threadId: pending.threadId,
        status: "failed",
        error: sent.error,
      });
      if (isTerminalCodexDeliveryError(sent.error) && input.config.botToken) {
        await sendTelegramReply({
          token: input.config.botToken,
          chatId: pending.chatId,
          replyToMessageId: pending.telegramMessageId,
          text: buildDeliveryFailureReply(sent.error),
          source: sourceContextForPending(pending),
          fetchImpl: input.fetchImpl,
        });
      }
      continue;
    }

    processed += 1;
    nextState = removePendingMessage(nextState, pending);
    if (sent.responseText && input.config.botToken) {
      const source = sourceContextForPending(pending);
      const formatted = formatTelegramGatewayMessage({ text: sent.responseText, ...source }).text;
      const telegramReply = await sendTelegramReply({
        token: input.config.botToken,
        chatId: pending.chatId,
        replyToMessageId: pending.telegramMessageId,
        text: sent.responseText,
        source,
        fetchImpl: input.fetchImpl,
      });
      if (telegramReply.ok && telegramReply.messageId) {
        replied += 1;
        nextState = recordOutboundMapping(nextState, {
          telegramMessageId: telegramReply.messageId,
          chatId: pending.chatId,
          threadId: pending.threadId,
          sessionId: source.sessionId,
          title: source.title,
        });
        nextState = appendHistory(nextState, {
          telegramMessageId: telegramReply.messageId,
          chatId: pending.chatId,
          direction: "outbound",
          text: formatted,
          route: pending.route,
          threadId: pending.threadId,
          status: "delivered",
          telegramReplyToMessageId: pending.telegramMessageId,
        });
      } else if (!telegramReply.ok) {
        failed += 1;
        nextState = appendHistory(nextState, {
          telegramMessageId: pending.telegramMessageId,
          chatId: pending.chatId,
          direction: "inbound",
          text: pending.text,
          route: pending.route,
          threadId: pending.threadId,
          status: "failed",
          turnId: sent.turnId,
          error: telegramReply.error,
        });
        continue;
      }
    }
    nextState = appendHistory(nextState, {
      telegramMessageId: pending.telegramMessageId,
      chatId: pending.chatId,
      direction: "inbound",
      text: pending.text,
      route: pending.route,
      threadId: pending.threadId,
      status: "delivered",
      turnId: sent.turnId,
    });
  }
  return { state: nextState, processed, replied, queued, failed };
}

function buildDeliveryFailureReply(error: string | undefined): string {
  return [
    "Telegram reached the mapped Codex thread, but Codex could not accept the turn.",
    "",
    `Reason: ${error ?? "unknown Codex delivery failure"}`,
  ].join("\n");
}

function sourceContextForRoute(route: Exclude<TelegramRouteDecision, { kind: "ignore" | "unknown_reply" }>): TelegramSourceContext {
  if (route.kind === "source_thread") {
    return {
      threadId: route.threadId,
      sessionId: route.mapping.sessionId,
      title: route.mapping.title ?? "Telegram gateway response",
    };
  }
  return {
    threadId: route.threadId,
    title: "Telegram coordinator",
  };
}

function sourceContextForPending(pending: {
  threadId: string;
  sessionId?: string;
  title?: string;
}): TelegramSourceContext {
  return {
    threadId: pending.threadId,
    sessionId: pending.sessionId,
    title: pending.title ?? "Telegram gateway response",
  };
}
