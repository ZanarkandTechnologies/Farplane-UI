/**
 * User communications config helpers.
 *
 * Inputs: Farplane runtime config payloads for the Telegram gateway.
 * Outputs: normalized non-secret configuration, TOML preview, and shell snippets.
 * Side effects: none; browser callers own bridge reads/writes.
 */

export type UserCommunicationsConfig = {
  mainThreadId: string;
  stateBase: string;
  codexAppServerUrl: string;
  botTokenConfigured: boolean;
  allowFrom: string;
};

export type TelegramGatewayHistoryEntry = {
  telegramMessageId: number;
  chatId: string;
  direction: "inbound" | "outbound";
  text: string;
  occurredAt: number;
  route?: "source_thread" | "new_thread" | "coordinator" | "unknown_reply";
  threadId?: string;
  status?: "delivered" | "queued" | "failed";
};

export type TelegramGatewayPendingMessage = {
  telegramMessageId: number;
  chatId: string;
  text: string;
  route: "source_thread" | "new_thread" | "coordinator";
  threadId: string;
  createdAt: number;
  attempts: number;
  lastAttemptAt?: number;
  lastError?: string;
};

export type TelegramGatewayMapping = {
  telegramMessageId: number;
  chatId: string;
  threadId: string;
  sessionId?: string;
  title?: string;
  createdAt: number;
};

export type TelegramGatewayState = {
  updateOffset: number;
  mappings: TelegramGatewayMapping[];
  history: TelegramGatewayHistoryEntry[];
  pending: TelegramGatewayPendingMessage[];
};

export type UserCommunicationRouteFilter = "all" | "reply" | "standalone" | "waiting" | "failed";

export type UserCommunicationActivityRow = {
  id: string;
  occurredAt: number;
  sourceThread: string;
  route:
    | "reply -> source"
    | "standalone -> new thread"
    | "standalone -> main"
    | "notification sent"
    | "unknown reply";
  status: "delivered" | "waiting reply" | "failed";
  text: string;
  threadId?: string;
};

function normalizeHistoryRoute(value: unknown): TelegramGatewayHistoryEntry["route"] {
  if (
    value === "source_thread" ||
    value === "new_thread" ||
    value === "coordinator" ||
    value === "unknown_reply"
  ) {
    return value;
  }
  return undefined;
}

function normalizeHistoryStatus(value: unknown): TelegramGatewayHistoryEntry["status"] {
  if (value === "queued" || value === "failed" || value === "delivered") {
    return value;
  }
  return undefined;
}

export const DEFAULT_USER_COMMUNICATIONS_CONFIG: UserCommunicationsConfig = {
  mainThreadId: "",
  stateBase: "http://127.0.0.1:5173",
  codexAppServerUrl: "ws://127.0.0.1:47891",
  botTokenConfigured: false,
  allowFrom: "",
};

export function normalizeUserCommunicationsConfig(
  input: Partial<UserCommunicationsConfig> | null | undefined,
): UserCommunicationsConfig {
  return {
    mainThreadId: input?.mainThreadId?.trim() ?? "",
    stateBase: input?.stateBase?.trim() || DEFAULT_USER_COMMUNICATIONS_CONFIG.stateBase,
    codexAppServerUrl:
      input?.codexAppServerUrl?.trim() || DEFAULT_USER_COMMUNICATIONS_CONFIG.codexAppServerUrl,
    botTokenConfigured: input?.botTokenConfigured === true,
    allowFrom: input?.allowFrom?.trim() ?? "",
  };
}

export function buildTelegramGatewayEnv(_config: UserCommunicationsConfig): string {
  const lines = ["farplane run -- npm run cli -- gateway telegram --once"];
  return lines.filter((line): line is string => Boolean(line)).join("\n");
}

function tomlString(value: string): string {
  return JSON.stringify(value);
}

export function buildTelegramGatewayConfigToml(config: UserCommunicationsConfig): string {
  const normalized = normalizeUserCommunicationsConfig(config);
  const allowFrom = normalized.allowFrom
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const lines = [
    "[runtime]",
    `ai_office_url = ${tomlString(normalized.stateBase)}`,
    `codex_app_server_url = ${tomlString(normalized.codexAppServerUrl)}`,
    "",
    "[telegram]",
    "enabled = true",
    'dm_policy = "allowlist"',
    "# TELEGRAM_BOT_TOKEN is injected into the gateway process environment.",
    `allow_from = [${allowFrom.map(tomlString).join(", ")}]`,
    `main_thread_id = ${tomlString(normalized.mainThreadId)}`,
    'group_policy = "allowlist"',
    "",
    "[telegram.streaming]",
    'mode = "off"',
  ];
  return `${lines.join("\n")}\n`;
}

export function emptyTelegramGatewayState(): TelegramGatewayState {
  return { updateOffset: 0, mappings: [], history: [], pending: [] };
}

export function normalizeTelegramGatewayState(input: unknown): TelegramGatewayState {
  const row = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const mappings = Array.isArray(row.mappings)
    ? row.mappings
        .filter((entry): entry is Record<string, unknown> =>
          Boolean(entry && typeof entry === "object"),
        )
        .map((entry) => ({
          telegramMessageId: Number(entry.telegramMessageId),
          chatId: String(entry.chatId ?? ""),
          threadId: String(entry.threadId ?? ""),
          sessionId: typeof entry.sessionId === "string" ? entry.sessionId : undefined,
          title: typeof entry.title === "string" ? entry.title : undefined,
          createdAt: Number(entry.createdAt),
        }))
        .filter(
          (entry) => Number.isFinite(entry.telegramMessageId) && entry.chatId && entry.threadId,
        )
    : [];
  const history = Array.isArray(row.history)
    ? row.history
        .filter((entry): entry is Record<string, unknown> =>
          Boolean(entry && typeof entry === "object"),
        )
        .map((entry) => ({
          telegramMessageId: Number(entry.telegramMessageId),
          chatId: String(entry.chatId ?? ""),
          direction: entry.direction === "outbound" ? ("outbound" as const) : ("inbound" as const),
          text: String(entry.text ?? ""),
          occurredAt: Number(entry.occurredAt),
          route: normalizeHistoryRoute(entry.route),
          threadId: typeof entry.threadId === "string" ? entry.threadId : undefined,
          status: normalizeHistoryStatus(entry.status),
        }))
        .filter(
          (entry) => Number.isFinite(entry.telegramMessageId) && Number.isFinite(entry.occurredAt),
        )
    : [];
  const pending = Array.isArray(row.pending)
    ? row.pending
        .filter((entry): entry is Record<string, unknown> =>
          Boolean(entry && typeof entry === "object"),
        )
        .map((entry) => ({
          telegramMessageId: Number(entry.telegramMessageId),
          chatId: String(entry.chatId ?? ""),
          text: String(entry.text ?? ""),
          route:
            entry.route === "coordinator"
              ? ("coordinator" as const)
              : entry.route === "new_thread"
                ? ("new_thread" as const)
                : ("source_thread" as const),
          threadId: String(entry.threadId ?? ""),
          createdAt: Number(entry.createdAt),
          attempts: Number(entry.attempts ?? 0),
          lastAttemptAt: Number.isFinite(Number(entry.lastAttemptAt))
            ? Number(entry.lastAttemptAt)
            : undefined,
          lastError: typeof entry.lastError === "string" ? entry.lastError : undefined,
        }))
        .filter(
          (entry) => Number.isFinite(entry.telegramMessageId) && entry.chatId && entry.threadId,
        )
    : [];
  return {
    updateOffset: Number.isFinite(Number(row.updateOffset)) ? Number(row.updateOffset) : 0,
    mappings,
    history,
    pending,
  };
}

function titleForThread(threadId: string | undefined, mappings: TelegramGatewayMapping[]): string {
  if (!threadId) return "Main comms thread";
  const mapping = mappings.find((entry) => entry.threadId === threadId);
  return mapping?.title?.trim() || threadId;
}

export function buildUserCommunicationActivityRows(
  state: TelegramGatewayState,
): UserCommunicationActivityRow[] {
  const inboundRows = state.history.map((entry) => ({
    id: `history-${entry.telegramMessageId}-${entry.occurredAt}`,
    occurredAt: entry.occurredAt,
    sourceThread: titleForThread(entry.threadId, state.mappings),
    route:
      entry.route === "source_thread"
        ? ("reply -> source" as const)
        : entry.route === "new_thread"
          ? ("standalone -> new thread" as const)
          : entry.route === "coordinator"
            ? ("standalone -> main" as const)
            : entry.route === "unknown_reply"
              ? ("unknown reply" as const)
              : entry.direction === "outbound"
                ? ("notification sent" as const)
                : ("standalone -> main" as const),
    status:
      entry.status === "queued"
        ? ("waiting reply" as const)
        : entry.status === "failed" || entry.route === "unknown_reply"
          ? ("failed" as const)
          : ("delivered" as const),
    text: entry.text,
    threadId: entry.threadId,
  }));
  const pendingRows = state.pending.map((entry) => ({
    id: `pending-${entry.telegramMessageId}-${entry.createdAt}`,
    occurredAt: entry.createdAt,
    sourceThread: titleForThread(entry.threadId, state.mappings),
    route:
      entry.route === "source_thread"
        ? ("reply -> source" as const)
        : entry.route === "new_thread"
          ? ("standalone -> new thread" as const)
          : ("standalone -> main" as const),
    status: "waiting reply" as const,
    text: entry.text,
    threadId: entry.threadId,
  }));
  const historyMessageIds = new Set(state.history.map((entry) => entry.telegramMessageId));
  const waitingRows = state.mappings
    .filter((mapping) => !historyMessageIds.has(mapping.telegramMessageId))
    .map((mapping) => ({
      id: `mapping-${mapping.telegramMessageId}-${mapping.createdAt}`,
      occurredAt: mapping.createdAt,
      sourceThread: mapping.title?.trim() || mapping.threadId,
      route: "notification sent" as const,
      status: "waiting reply" as const,
      text: `Telegram message ${mapping.telegramMessageId}`,
      threadId: mapping.threadId,
    }));
  return [...inboundRows, ...pendingRows, ...waitingRows].sort(
    (left, right) => right.occurredAt - left.occurredAt,
  );
}

export function filterUserCommunicationActivityRows(
  rows: UserCommunicationActivityRow[],
  routeFilter: UserCommunicationRouteFilter,
  search: string,
): UserCommunicationActivityRow[] {
  const query = search.trim().toLowerCase();
  return rows.filter((row) => {
    const matchesFilter =
      routeFilter === "all" ||
      (routeFilter === "reply" && row.route === "reply -> source") ||
      (routeFilter === "standalone" &&
        (row.route === "standalone -> main" || row.route === "standalone -> new thread")) ||
      (routeFilter === "waiting" && row.status === "waiting reply") ||
      (routeFilter === "failed" && row.status === "failed");
    if (!matchesFilter) return false;
    if (!query) return true;
    return `${row.sourceThread} ${row.route} ${row.status} ${row.text} ${row.threadId ?? ""}`
      .toLowerCase()
      .includes(query);
  });
}
