import path from "node:path";

export type JsonObject = Record<string, unknown>;

export type MiningThreadSource = {
  id: string;
  safeFileId?: string;
  sessionId?: string;
  threadId?: string;
  name: string;
  preview: string;
  cwd?: string;
  inputRef?: string;
  ticketId?: string;
  updatedAt?: number;
  sourceKind?: string;
};

export function isSafeMiningFileId(value: string): boolean {
  return /^[A-Za-z0-9._-]+$/.test(value) && !value.includes("..");
}

export function safeMiningId(value: string, fallback: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
  return normalized && isSafeMiningFileId(normalized) ? normalized : fallback;
}

export function assertSafeMiningFileId(value: string, kind: string): string {
  const trimmed = value.trim();
  if (!isSafeMiningFileId(trimmed)) throw new Error(`unsafe_${kind}_id`);
  return trimmed;
}

export function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((entry) => String(entry ?? "").trim()).filter(Boolean))];
}

function compactText(value: unknown, fallback = ""): string {
  const text = typeof value === "string" ? value : fallback;
  return text.replace(/\s+/g, " ").trim();
}

function normalizedTimestamp(value: unknown): number | undefined {
  const raw = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(raw) || raw <= 0) return undefined;
  return raw > 1_000_000_000_000 ? Math.floor(raw / 1000) : raw;
}

export function normalizeCodexThreadSource(value: unknown): MiningThreadSource | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as JsonObject;
  const id = compactText(row.id ?? row.threadId ?? row.sessionId);
  if (!id) return null;
  const source = row.source && typeof row.source === "object" ? (row.source as JsonObject) : {};
  const name = compactText(row.name ?? row.title ?? row.preview, id);
  const preview = compactText(row.preview ?? row.summary, name);
  const safeFileId = isSafeMiningFileId(id) ? id : undefined;
  return {
    id,
    safeFileId,
    sessionId: compactText(row.sessionId) || undefined,
    name: name || `Codex thread ${id.slice(0, 8)}`,
    preview: preview || `Codex thread ${id}`,
    cwd: compactText(row.cwd) || undefined,
    updatedAt: normalizedTimestamp(row.updatedAt),
    sourceKind: compactText(source.kind) || undefined,
  };
}

export function normalizeStoredMiningSource(value: unknown): MiningThreadSource | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as JsonObject;
  const id = compactText(row.id ?? row.sourceId ?? row.threadId ?? row.sessionId);
  if (!id) return null;
  const sourceKind = compactText(row.sourceKind);
  const safeFileId = isSafeMiningFileId(id) ? id : undefined;
  return {
    id,
    safeFileId,
    sessionId: compactText(row.sessionId) || undefined,
    threadId: compactText(row.threadId) || undefined,
    name: compactText(row.name ?? row.preview, id),
    preview: compactText(row.preview ?? row.name, id),
    cwd: compactText(row.cwd) || undefined,
    inputRef: compactText(row.inputRef) || undefined,
    ticketId: compactText(row.ticketId) || undefined,
    updatedAt: normalizedTimestamp(row.updatedAt),
    sourceKind: sourceKind === "message_window" ? "farplane-message-window" : sourceKind || undefined,
  };
}

export function messageWindowPathForSource(source: MiningThreadSource): string | null {
  if (!source.cwd || source.sourceKind !== "farplane-message-window") return null;
  const safeFileId = assertSafeMiningFileId(source.safeFileId ?? source.id, "source");
  return path.join(source.cwd, ".farplane", "state", "message-windows", `${safeFileId}.json`);
}

export function threadSourceToMiningSource(source: MiningThreadSource): JsonObject {
  const inputRef = messageWindowPathForSource(source) ?? `codex-thread:${source.id}`;
  const sourceKind =
    source.sourceKind === "farplane-message-window"
      ? "message_window"
      : source.sourceKind && source.sourceKind !== "codex-thread"
        ? source.sourceKind
        : "codex_thread";
  return {
    sourceId: source.id,
    safeFileId: source.safeFileId,
    sourceKind,
    inputRef: source.inputRef ?? inputRef,
    name: source.name,
    preview: source.preview,
    cwd: source.cwd,
    sessionId: source.sessionId,
    ticketId: source.ticketId,
    threadId: source.threadId ?? source.id,
    updatedAt: source.updatedAt,
  };
}

export function fileEventToMiningSource(value: unknown): JsonObject | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as JsonObject;
  const eventKey = compactText(row.eventKey);
  const filePath = compactText(row.path);
  const entityId = compactText(row.entityId);
  if (!eventKey && !filePath) return null;
  return {
    sourceId: safeMiningId(eventKey || filePath, "file-event"),
    sourceKind: "file_event",
    inputRef: filePath || `event:${eventKey}`,
    name: compactText(row.eventName, "Farplane file event"),
    preview: compactText(row.summary),
    ticketId: entityId.startsWith("TASK-") ? entityId : undefined,
    sessionId: compactText(row.sessionId) || undefined,
    threadId: compactText(row.threadId) || undefined,
    updatedAt: normalizedTimestamp(row.eventAt ?? row.updatedAt),
    sourceEventKey: eventKey || undefined,
    provider: compactText(row.provider) || "local_file",
    externalId: compactText(row.externalId) || undefined,
  };
}

export function ticketCompletionEventToMiningSource(value: unknown): JsonObject | null {
  const source = fileEventToMiningSource(value);
  return source ? { ...source, sourceKind: "ticket_packet" } : null;
}
