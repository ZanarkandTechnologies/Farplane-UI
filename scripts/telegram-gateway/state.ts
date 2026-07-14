/**
 * Local JSON state helpers for the Telegram gateway.
 *
 * Inputs: gateway state fragments and ~/.farplane paths.
 * Outputs: normalized state snapshots and queue/history mutations.
 * Side effects: reads/writes the local gateway state file.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type {
  ReviewRelayBinding,
  ReviewRelayReceipt,
  TelegramGatewayHistoryEntry,
  TelegramGatewayMapping,
  TelegramGatewayPendingMessage,
  TelegramGatewayState,
} from "./types";

export function emptyGatewayState(): TelegramGatewayState {
  return { updateOffset: 0, mappings: [], history: [], pending: [], reviewBindings: [], reviewReceipts: [] };
}

export function mergeGatewayState(
  base: TelegramGatewayState,
  incoming: TelegramGatewayState,
): TelegramGatewayState {
  const mappingRows = new Map<string, TelegramGatewayMapping>();
  for (const mapping of [...incoming.mappings, ...base.mappings]) {
    mappingRows.set(`${mapping.chatId}:${mapping.telegramMessageId}`, mapping);
  }
  const historyRows = new Map<string, TelegramGatewayHistoryEntry>();
  for (const entry of [...incoming.history, ...base.history]) {
    historyRows.set(`${entry.chatId}:${entry.telegramMessageId}:${entry.direction}:${entry.status ?? ""}`, entry);
  }
  const pendingRows = new Map<string, TelegramGatewayPendingMessage>();
  for (const entry of [...incoming.pending, ...base.pending]) {
    pendingRows.set(`${entry.chatId}:${entry.telegramMessageId}`, entry);
  }
  const bindingRows = new Map<string, ReviewRelayBinding>();
  for (const binding of [...incoming.reviewBindings, ...base.reviewBindings]) {
    bindingRows.set(binding.reviewId, binding);
  }
  const receiptRows = new Map<string, ReviewRelayReceipt>();
  for (const receipt of [...incoming.reviewReceipts, ...base.reviewReceipts]) {
    receiptRows.set(`${receipt.reviewId}:${receipt.idempotencyKey}`, receipt);
  }
  for (const entry of historyRows.values()) {
    if (entry.direction === "inbound" && entry.status === "delivered") {
      pendingRows.delete(`${entry.chatId}:${entry.telegramMessageId}`);
    }
    if (entry.direction === "inbound" && entry.status === "failed" && isTerminalPendingFailure(entry.error)) {
      pendingRows.delete(`${entry.chatId}:${entry.telegramMessageId}`);
    }
  }
  return {
    updateOffset: Math.max(base.updateOffset, incoming.updateOffset),
    mappings: [...mappingRows.values()].sort((left, right) => right.createdAt - left.createdAt).slice(0, 500),
    history: [...historyRows.values()].sort((left, right) => right.occurredAt - left.occurredAt).slice(0, 200),
    pending: [...pendingRows.values()].sort((left, right) => left.createdAt - right.createdAt).slice(0, 200),
    reviewBindings: [...bindingRows.values()].sort((left, right) => right.createdAt - left.createdAt).slice(0, 500),
    reviewReceipts: [...receiptRows.values()]
      .sort((left, right) => right.occurredAt - left.occurredAt)
      .slice(0, 500),
  };
}

function isTerminalPendingFailure(error: string | undefined): boolean {
  return Boolean(error?.toLowerCase().includes("ran out of room in the model's context window"));
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

export function queuePendingMessage(
  state: TelegramGatewayState,
  entry: Omit<TelegramGatewayPendingMessage, "createdAt" | "attempts"> & {
    createdAt?: number;
    attempts?: number;
  },
): TelegramGatewayState {
  const pending = state.pending.filter(
    (candidate) => !(candidate.telegramMessageId === entry.telegramMessageId && candidate.chatId === entry.chatId),
  );
  pending.push({
    ...entry,
    createdAt: entry.createdAt ?? Date.now(),
    attempts: entry.attempts ?? 0,
  });
  return { ...state, pending: pending.sort((left, right) => left.createdAt - right.createdAt).slice(0, 200) };
}

export function removePendingMessage(
  state: TelegramGatewayState,
  entry: Pick<TelegramGatewayPendingMessage, "telegramMessageId" | "chatId">,
): TelegramGatewayState {
  return {
    ...state,
    pending: state.pending.filter(
      (candidate) => !(candidate.telegramMessageId === entry.telegramMessageId && candidate.chatId === entry.chatId),
    ),
  };
}

export function updatePendingMessage(
  state: TelegramGatewayState,
  entry: TelegramGatewayPendingMessage,
  patch: Partial<TelegramGatewayPendingMessage>,
): TelegramGatewayState {
  return {
    ...state,
    pending: state.pending.map((candidate) =>
      candidate.telegramMessageId === entry.telegramMessageId && candidate.chatId === entry.chatId
        ? { ...candidate, ...patch }
        : candidate,
    ),
  };
}

export function recordReviewRelayBinding(
  state: TelegramGatewayState,
  binding: ReviewRelayBinding,
): TelegramGatewayState {
  return {
    ...state,
    reviewBindings: [
      binding,
      ...state.reviewBindings.filter((candidate) => candidate.reviewId !== binding.reviewId),
    ].slice(0, 500),
  };
}

export function recordReviewRelayReceipt(
  state: TelegramGatewayState,
  receipt: Omit<ReviewRelayReceipt, "occurredAt"> & { occurredAt?: number },
): TelegramGatewayState {
  return {
    ...state,
    reviewReceipts: [
      { ...receipt, occurredAt: receipt.occurredAt ?? Date.now() },
      ...state.reviewReceipts.filter(
        (candidate) =>
          !(candidate.reviewId === receipt.reviewId && candidate.idempotencyKey === receipt.idempotencyKey),
      ),
    ].slice(0, 500),
  };
}

export function markReviewRelayBindingUsed(
  state: TelegramGatewayState,
  reviewId: string,
  usedAt = Date.now(),
): TelegramGatewayState {
  return {
    ...state,
    reviewBindings: state.reviewBindings.map((binding) =>
      binding.reviewId === reviewId ? { ...binding, usedAt } : binding,
    ),
  };
}

export async function loadGatewayState(statePath = defaultStatePath()): Promise<TelegramGatewayState> {
  try {
    const raw = await readFile(statePath, "utf8");
    const parsed = JSON.parse(raw) as TelegramGatewayState;
    return {
      updateOffset: Number.isFinite(parsed.updateOffset) ? parsed.updateOffset : 0,
      mappings: Array.isArray(parsed.mappings) ? parsed.mappings : [],
      history: Array.isArray(parsed.history) ? parsed.history : [],
      pending: Array.isArray(parsed.pending) ? parsed.pending : [],
      reviewBindings: Array.isArray(parsed.reviewBindings) ? parsed.reviewBindings : [],
      reviewReceipts: Array.isArray(parsed.reviewReceipts) ? parsed.reviewReceipts : [],
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
