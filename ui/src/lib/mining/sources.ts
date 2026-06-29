/**
 * Mining source normalizers
 * Inputs: thread rows, typed Farplane file events, provider webhooks, and ticket packets.
 * Outputs: compact replayable MiningSource rows with stable ids.
 * Side effects: none; callers own storage and transcript expansion.
 */

import type { CreateMiningRunInput, MiningSource } from "@/lib/mining/types";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function compactText(value: unknown, fallback = ""): string {
  const text = typeof value === "string" ? value : fallback;
  return text.replace(/\s+/g, " ").trim();
}

function safeSourceId(value: unknown, fallback: string): string {
  const normalized = compactText(value)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
  return normalized || fallback;
}

function normalizedTimestamp(value: unknown): number | undefined {
  const raw = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(raw) || raw <= 0) return undefined;
  return raw > 1_000_000_000_000 ? Math.floor(raw / 1000) : raw;
}

export function historicalThreadSourceToMiningSource(value: unknown): MiningSource | null {
  if (!isRecord(value)) return null;
  const id = compactText(value.id ?? value.threadId ?? value.sessionId);
  if (!id) return null;
  const nestedSource = isRecord(value.source) ? value.source : {};
  const name = compactText(value.name ?? value.title ?? value.preview, id);
  const preview = compactText(value.preview ?? value.summary, name);
  const sourceKind =
    compactText(nestedSource.kind) === "farplane-message-window"
      ? "message_window"
      : "codex_thread";
  return {
    sourceId: id,
    sourceKind,
    inputRef: compactText(value.cwd)
      ? `${String(value.cwd)}/.farplane/state/message-windows/${id}.json`
      : `codex-thread:${id}`,
    name: name || `Codex thread ${id.slice(0, 8)}`,
    preview: preview || `Codex thread ${id}`,
    cwd: compactText(value.cwd) || undefined,
    sessionId: compactText(value.sessionId) || undefined,
    threadId: id,
    updatedAt: normalizedTimestamp(value.updatedAt),
  };
}

export function fileEventToMiningSource(value: unknown): MiningSource | null {
  if (!isRecord(value)) return null;
  const eventKey = compactText(value.eventKey);
  const path = compactText(value.path);
  const entityId = compactText(value.entityId);
  if (!eventKey && !path) return null;
  return {
    sourceId: safeSourceId(eventKey || path, "file-event"),
    sourceKind: "file_event",
    inputRef: path || `event:${eventKey}`,
    name: compactText(value.eventName, "Farplane file event"),
    preview: compactText(value.summary),
    ticketId: entityId.startsWith("TASK-") ? entityId : undefined,
    sessionId: compactText(value.sessionId) || undefined,
    threadId: compactText(value.threadId) || undefined,
    sourceEventKey: eventKey || undefined,
    provider: compactText(value.provider) || "local_file",
    externalId: compactText(value.externalId) || undefined,
  };
}

export function ticketCompletionEventToMiningSource(value: unknown): MiningSource | null {
  const source = fileEventToMiningSource(value);
  if (!source) return null;
  return {
    ...source,
    sourceKind: "ticket_packet",
    inputRef: source.inputRef,
  };
}

export function providerEventToMiningSource(value: unknown): MiningSource | null {
  if (!isRecord(value)) return null;
  const provider = compactText(value.provider);
  const externalId = compactText(value.externalId ?? value.id);
  if (!provider || !externalId) return null;
  return {
    sourceId: safeSourceId(`${provider}-${externalId}`, "provider-event"),
    sourceKind: "provider_event",
    inputRef: `${provider}:${externalId}`,
    name: compactText(value.eventName ?? value.type, "Provider event"),
    preview: compactText(value.summary),
    ticketId: compactText(value.ticketId) || undefined,
    sourceEventKey: compactText(value.eventKey) || undefined,
    provider,
    externalId,
  };
}

export function sourceEventToMiningRunRequest(
  event: unknown,
  programId: string,
): CreateMiningRunInput | null {
  const source = fileEventToMiningSource(event) ?? providerEventToMiningSource(event);
  if (!source) return null;
  const eventName = isRecord(event) ? compactText(event.eventName) : "";
  return {
    mode: eventName === "farplane.ticket.completed" ? "ticket_completion" : "event_triggered",
    source: source.provider === "local_file" ? "hook" : "provider",
    programId,
    sources: [
      eventName === "farplane.ticket.completed"
        ? { ...source, sourceKind: "ticket_packet" }
        : source,
    ],
    sourceEventKey: source.sourceEventKey,
  };
}
