/**
 * Shared contracts for the local Telegram gateway.
 *
 * Inputs: Telegram Bot API updates, Codex exec JSONL payloads, TOML runtime
 * config, and local gateway state JSON.
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
  route?: "source_thread" | "new_thread" | "coordinator" | "unknown_reply" | "review_relay";
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
  route: "source_thread" | "coordinator" | "review_relay";
  threadId: string;
  sessionId?: string;
  title?: string;
  reviewId?: string;
  reviewDecision?: ReviewRelayDecision;
  reviewReason?: string;
  idempotencyKey?: string;
  createdAt: number;
  attempts: number;
  lastAttemptAt?: number;
  lastError?: string;
};

export type ReviewRelayDecision = "approve" | "revise" | "reject";

export type ReviewRelayBinding = {
  reviewId: string;
  capabilityHash: string;
  threadId: string;
  title?: string;
  createdAt: number;
  expiresAt: number;
  usedAt?: number;
  cycle: string;
};

export type ReviewRelayReceipt = {
  reviewId: string;
  idempotencyKey: string;
  decision: ReviewRelayDecision;
  reason: string;
  status: "delivered" | "queued" | "failed" | "rejected";
  turnId?: string;
  error?: string;
  occurredAt: number;
};

export type TelegramGatewayState = {
  updateOffset: number;
  mappings: TelegramGatewayMapping[];
  history: TelegramGatewayHistoryEntry[];
  pending: TelegramGatewayPendingMessage[];
  reviewBindings: ReviewRelayBinding[];
  reviewReceipts: ReviewRelayReceipt[];
};

export type TelegramGatewayConfig = {
  allowedChatIds: string[];
  defaultThreadId?: string;
  botToken?: string;
  responseTimeoutMs?: number;
  appServerUrl?: string;
  reviewRelayPort?: number;
};

export type TelegramGatewayFileConfig = {
  version?: number;
  runtime?: {
    appServerUrl?: string;
  };
  telegram?: {
    enabled?: boolean;
    dmPolicy?: "allowlist";
    botToken?: string;
    allowFrom?: string[];
    defaultThreadId?: string;
    groupPolicy?: "allowlist";
    streaming?: {
      mode?: "off";
    };
    reviewRelay?: {
      port?: number;
    };
  };
};

export type ResolvedTelegramGatewayConfig = TelegramGatewayConfig & {
  botToken: string;
  enabled: boolean;
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

export type TelegramDocumentResult = TelegramSendMessageResult & {
  document?: { file_id?: string; file_name?: string };
};

export type TelegramPhotoResult = TelegramSendMessageResult & {
  photo?: Array<{ file_id?: string; width?: number; height?: number }>;
};

export type TelegramSourceContext = {
  threadId: string;
  sessionId?: string;
  title?: string;
};

export type CodexTurnItem = {
  type?: string;
  text?: string;
  content?: Array<{ type?: string; text?: string }>;
};

export type TelegramRouteDecision =
  | { kind: "ignore"; reason: string }
  | { kind: "source_thread"; threadId: string; text: string; mapping: TelegramGatewayMapping }
  | { kind: "coordinator"; threadId: string; text: string; prompt: string }
  | { kind: "unknown_reply"; text: string; replyToMessageId: number };
