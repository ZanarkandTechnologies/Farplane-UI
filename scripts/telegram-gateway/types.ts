/**
 * Shared contracts for the local Telegram gateway.
 *
 * Inputs: Telegram Bot API updates, Codex app-server RPC payloads, and local
 * gateway config/state JSON.
 * Outputs: typed routing decisions, state records, and delivery results.
 * Side effects: none.
 */

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
  status?: "delivered" | "queued" | "failed";
  turnId?: string;
  error?: string;
  telegramReplyToMessageId?: number;
};

export type TelegramGatewayPendingMessage = {
  telegramMessageId: number;
  chatId: string;
  text: string;
  promptText?: string;
  route: "source_thread" | "coordinator";
  threadId: string;
  createdAt: number;
  attempts: number;
  lastAttemptAt?: number;
  lastError?: string;
};

export type TelegramGatewayState = {
  updateOffset: number;
  mappings: TelegramGatewayMapping[];
  history: TelegramGatewayHistoryEntry[];
  pending: TelegramGatewayPendingMessage[];
};

export type TelegramGatewayConfig = {
  allowedChatIds: string[];
  coordinatorThreadId?: string;
  codexAppServerUrl?: string;
  botToken?: string;
  responseTimeoutMs?: number;
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

export type JsonRpcMessage = {
  id?: string | number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code?: number; message?: string; data?: unknown };
};

export type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    chat?: { id?: number | string };
    text?: string;
    caption?: string;
    date?: number;
    reply_to_message?: {
      message_id?: number;
      text?: string;
      caption?: string;
    };
  };
};

export type TelegramSendMessageResult = {
  message_id: number;
  chat?: { id?: number | string };
  text?: string;
};

export type CodexTurnItem = {
  type?: string;
  text?: string;
  content?: Array<{ type?: string; text?: string }>;
};

export type CodexTurn = {
  id: string;
  status?: string;
  completedAt?: number | null;
  items?: CodexTurnItem[];
};

export type TelegramRouteDecision =
  | { kind: "ignore"; reason: string }
  | { kind: "source_thread"; threadId: string; text: string; mapping: TelegramGatewayMapping }
  | { kind: "coordinator"; threadId: string; text: string; prompt: string }
  | { kind: "unknown_reply"; text: string; replyToMessageId: number };
