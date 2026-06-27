/**
 * CODEX EVENT MINER HELPERS
 * =========================
 * Ownership: Codex event miner hook package.
 * Inputs/outputs: untrusted JSON values, hook payload metadata, and stable telemetry ids.
 * Side effects: read-only dotenv/file parsing for local config helpers.
 * Invariants: helpers sanitize text, cap strings, and never preserve raw transcript bodies.
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { JsonRecord, MinerEventCandidate, MinerEventName, MinerMetadata } from "./types";

export function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function cleanString(value: unknown, limit = 500): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, limit) : undefined;
}

export function cleanMultiline(value: unknown, limit = 8_000): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, limit) : undefined;
}

export function number(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function safeIdPart(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9_.:-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120) || "unknown"
  );
}

export function stableHash(value: unknown): string {
  return createHash("sha1").update(JSON.stringify(value)).digest("hex").slice(0, 16);
}

function projectIdFromPath(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug ? `codex-proj-${slug}` : undefined;
}

export function resolveOccurredAt(payload: JsonRecord, now: number): number {
  const direct = payload.timestamp ?? payload.occurredAt ?? payload.occurred_at;
  if (typeof direct === "number" && Number.isFinite(direct)) return direct;
  const parsed = Date.parse(cleanString(direct, 80) ?? "");
  return Number.isFinite(parsed) ? parsed : now;
}

export function resolveStopEventName(payload: JsonRecord): string {
  return (
    cleanString(payload.event, 120) ??
    cleanString(payload.hook_event_name, 120) ??
    cleanString(payload.hookEventName, 120) ??
    cleanString(payload.type, 120) ??
    "Stop"
  );
}

export function resolveMetadata(payload: JsonRecord): MinerMetadata {
  const session = isRecord(payload.session) ? payload.session : {};
  const thread = isRecord(payload.thread) ? payload.thread : {};
  const projectPath =
    cleanString(payload.cwd, 1_000) ??
    cleanString(payload.projectPath, 1_000) ??
    cleanString(payload.project_path, 1_000);
  const sessionId =
    cleanString(payload.sessionId, 200) ??
    cleanString(payload.session_id, 200) ??
    cleanString(session.id, 200) ??
    cleanString(session.key, 200);
  const threadId =
    cleanString(payload.threadId, 200) ??
    cleanString(payload.thread_id, 200) ??
    cleanString(thread.id, 200) ??
    sessionId;
  return {
    sessionId,
    threadId,
    turnId: cleanString(payload.turnId, 200) ?? cleanString(payload.turn_id, 200),
    projectPath,
    projectId:
      cleanString(payload.projectId, 160) ??
      cleanString(payload.project_id, 160) ??
      projectIdFromPath(projectPath),
  };
}

export function inferTicketId(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    if (!value) continue;
    const match = value.match(/\b(?:TASK-\d{4}|TKT-\d{3,})\b/i);
    if (match?.[0]) return match[0].toUpperCase();
  }
  return undefined;
}

export function buildEventKey(input: {
  eventName: MinerEventName;
  projectId?: string;
  ticketId?: string;
  sessionId?: string;
  turnId?: string;
  summary?: string;
  sourceProgram?: string;
  reviewRunPath?: string;
}): string {
  const hash = stableHash({
    eventName: input.eventName,
    ticketId: input.ticketId,
    sessionId: input.sessionId,
    turnId: input.turnId,
    sourceProgram: input.sourceProgram,
    reviewRunPath: input.reviewRunPath,
    summary: input.summary,
  });
  return [
    "codex-event-miner",
    "v1",
    safeIdPart(input.eventName),
    safeIdPart(input.projectId ?? "project"),
    safeIdPart(input.ticketId ?? "ticket"),
    safeIdPart(input.sessionId ?? "session"),
    safeIdPart(input.turnId ?? input.reviewRunPath ?? "turn"),
    hash,
  ]
    .join(":")
    .slice(0, 500);
}

export function eventBase(input: {
  eventName: MinerEventName;
  metadata: MinerMetadata;
  ticketId?: string;
  sourceProgram: string;
  source: MinerEventCandidate["source"];
  summary: string;
  occurredAt: number;
  status?: string;
  severity?: MinerEventCandidate["severity"];
  reviewRunPath?: string;
}): Omit<MinerEventCandidate, "eventKey"> {
  return {
    eventName: input.eventName,
    sessionId: input.metadata.sessionId,
    threadId: input.metadata.threadId,
    turnId: input.metadata.turnId,
    ticketId: input.ticketId,
    projectPath: input.metadata.projectPath,
    projectId: input.metadata.projectId,
    sourceProgram: input.sourceProgram,
    source: input.source,
    status: input.status,
    severity: input.severity,
    summary: cleanString(input.summary, 360) ?? input.eventName,
    reviewRunPath: input.reviewRunPath,
    occurredAt: input.occurredAt,
  };
}

export function withEventKey(candidate: Omit<MinerEventCandidate, "eventKey">): MinerEventCandidate {
  return {
    ...candidate,
    eventKey: buildEventKey({
      eventName: candidate.eventName,
      projectId: candidate.projectId,
      ticketId: candidate.ticketId,
      sessionId: candidate.sessionId,
      turnId: candidate.turnId,
      summary: candidate.summary,
      sourceProgram: candidate.sourceProgram,
      reviewRunPath: candidate.reviewRunPath,
    }),
  };
}

export function parseJsonFile(filePath: string): JsonRecord | undefined {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function readDotenvValue(filePath: string, key: string): string | undefined {
  let text: string;
  try {
    text = fs.readFileSync(filePath, "utf8");
  } catch {
    return undefined;
  }
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || match[1] !== key) continue;
    return match[2].replace(/\s+#.*$/, "").trim().replace(/^['"]|['"]$/g, "");
  }
  return undefined;
}

export function relativeReportRunPath(projectPath: string, reportPath: string): string {
  return path.relative(projectPath, reportPath).replace(/\\/g, "/").replace(/\/report\.json$/i, "");
}
