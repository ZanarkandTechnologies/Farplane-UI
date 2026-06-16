import { type HookTelemetryPayload } from "./validators";

const MAX_TEXT_LENGTH = 1_000;
const MAX_PAYLOAD_BYTES = 16_000;
const MAX_ARRAY_ITEMS = 50;
const MAX_OBJECT_KEYS = 80;
const MAX_DEPTH = 6;

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanString(value: unknown, limit = MAX_TEXT_LENGTH): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, limit);
}

function sanitizePayload(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return "[max-depth]";
  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return value.slice(0, MAX_TEXT_LENGTH);
  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_ITEMS).map((entry) => sanitizePayload(entry, depth + 1));
  }
  if (!isRecord(value)) return undefined;
  const output: JsonRecord = {};
  for (const [key, child] of Object.entries(value).slice(0, MAX_OBJECT_KEYS)) {
    const normalizedKey = key.trim().slice(0, 120);
    if (!normalizedKey) continue;
    if (/^(tool_response|toolResponse|output|stdout|stderr|transcript|content)$/i.test(normalizedKey)) {
      const text = cleanString(child, 500);
      output[normalizedKey] = text ? `${text}${typeof child === "string" && child.length > 500 ? "..." : ""}` : "[redacted]";
      continue;
    }
    const sanitized = sanitizePayload(child, depth + 1);
    if (typeof sanitized !== "undefined") output[normalizedKey] = sanitized;
  }
  return output;
}

function payloadSize(value: unknown): number {
  try {
    return JSON.stringify(value).length;
  } catch {
    return MAX_PAYLOAD_BYTES + 1;
  }
}

function capPayload(value: unknown): unknown {
  const sanitized = sanitizePayload(value);
  if (payloadSize(sanitized) <= MAX_PAYLOAD_BYTES) return sanitized;
  return {
    truncated: true,
    reason: "payload_size_limit",
  };
}

export type ParsedHookTelemetryPayload = Omit<
  HookTelemetryPayload,
  "hookName" | "hookType" | "eventAt"
> & {
  hookName: string;
  hookType: string;
  eventAt: number;
};

export function parseHookTelemetryPayload(body: unknown, now = Date.now()): ParsedHookTelemetryPayload | null {
  if (!isRecord(body)) return null;
  const hookName = cleanString(body.hookName, 160);
  const hookType =
    cleanString(body.hookType, 160) ??
    cleanString(body.hook_event_name, 160) ??
    cleanString(body.event, 160);
  if (!hookName || !hookType) return null;

  const payload = isRecord(body.payload) ? capPayload(body.payload) : undefined;
  const sessionId = cleanString(body.sessionId, 200) ?? cleanString(body.session_id, 200);
  const eventAt = typeof body.eventAt === "number" && Number.isFinite(body.eventAt) ? body.eventAt : now;

  return {
    hookName,
    hookType,
    projectId: cleanString(body.projectId, 160),
    sessionId,
    payload,
    eventAt,
    eventKey: cleanString(body.eventKey, 500),
  };
}

export function parseHookTelemetryBatchPayload(body: unknown): ParsedHookTelemetryPayload[] | null {
  if (!isRecord(body) || !Array.isArray(body.events)) return null;
  const parsed = body.events.slice(0, 500).map((entry) => parseHookTelemetryPayload(entry));
  if (parsed.some((entry) => entry === null)) return null;
  return parsed.filter((entry): entry is ParsedHookTelemetryPayload => entry !== null);
}
