/**
 * THREAD LINEAGE LISTENER HOOK
 * ============================
 * Ownership: Codex PostToolUse hook package.
 * Inputs: untrusted hook payload JSON from stdin.
 * Outputs: compact thread.created/thread.forked telemetry envelopes.
 * Side effects: network POST only through publishThreadLineageEvents.
 * Invariants: raw prompts, transcripts, and full tool outputs are never persisted.
 */

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { publishHookTelemetryWithOutbox } from "../shared/telemetry-outbox";
import { firstFarplaneConfigValue, readFarplaneConfigValue } from "../../cli/runtime-config";

type JsonRecord = Record<string, unknown>;

export type ThreadLineageEventName = "thread.created" | "thread.forked";

export type ThreadLineageCandidate = {
  eventName: ThreadLineageEventName;
  sourceTool: "create_thread" | "fork_thread";
  parentThreadId?: string;
  parentSessionId?: string;
  childThreadId?: string;
  pendingWorktreeId?: string;
  title?: string;
  projectPath?: string;
  projectId?: string;
  turnId?: string;
  occurredAt: number;
  eventKey: string;
};

export type PublishThreadLineageOptions = {
  endpointBaseUrl?: string;
  telemetryToken?: string;
  fetchImpl?: typeof fetch;
};

const MAX_OBJECT_SCAN_KEYS = 80;
const MAX_ARRAY_SCAN_ITEMS = 50;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanString(value: unknown, limit = 240): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, limit) : undefined;
}

function findFirstRecord(...values: unknown[]): JsonRecord | undefined {
  return values.find(isRecord);
}

function resolveEventName(payload: JsonRecord): string {
  return (
    cleanString(payload.event, 120) ??
    cleanString(payload.hook_event_name, 120) ??
    cleanString(payload.hookEventName, 120) ??
    cleanString(payload.type, 120) ??
    "PostToolUse"
  );
}

function resolveToolName(payload: JsonRecord): string {
  return (
    cleanString(payload.toolName, 160) ??
    cleanString(payload.tool_name, 160) ??
    cleanString(payload.tool, 160) ??
    cleanString(findFirstRecord(payload.tool)?.name, 160) ??
    cleanString(findFirstRecord(payload.toolCall)?.name, 160) ??
    cleanString(findFirstRecord(payload.tool_call)?.name, 160) ??
    "unknown"
  );
}

function normalizeThreadToolName(value: string): "create_thread" | "fork_thread" | null {
  const normalized = value.trim().replace(/^codex_app[._-]/, "").replace(/^codex-app[._-]/, "");
  if (/(^|[._:-])create_thread$/i.test(normalized) || /create.?thread/i.test(normalized)) return "create_thread";
  if (/(^|[._:-])fork_thread$/i.test(normalized) || /fork.?thread/i.test(normalized)) return "fork_thread";
  return null;
}

function resolveOccurredAt(payload: JsonRecord, now: number): number {
  const direct = payload.timestamp ?? payload.occurredAt ?? payload.occurred_at;
  if (typeof direct === "number" && Number.isFinite(direct)) return direct;
  const parsed = Date.parse(cleanString(direct, 80) ?? "");
  return Number.isFinite(parsed) ? parsed : now;
}

function projectIdFromPath(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug ? `codex-proj-${slug}` : undefined;
}

function resolveMetadata(payload: JsonRecord): {
  parentSessionId?: string;
  parentThreadId?: string;
  turnId?: string;
  projectPath?: string;
  projectId?: string;
} {
  const session = findFirstRecord(payload.session);
  const thread = findFirstRecord(payload.thread);
  const sourceThread = findFirstRecord(payload.sourceThread);
  const parentThread = findFirstRecord(payload.parentThread);
  const turn = findFirstRecord(payload.turn);
  const projectPath =
    cleanString(payload.cwd, 1_000) ??
    cleanString(payload.projectPath, 1_000) ??
    cleanString(payload.project_path, 1_000);
  const parentSessionId =
    cleanString(payload.sessionId, 200) ??
    cleanString(payload.session_id, 200) ??
    cleanString(session?.id, 200) ??
    cleanString(session?.key, 200);
  return {
    parentSessionId,
    parentThreadId:
      cleanString(payload.parentThreadId, 200) ??
      cleanString(payload.parent_thread_id, 200) ??
      cleanString(payload.sourceThreadId, 200) ??
      cleanString(payload.source_thread_id, 200) ??
      cleanString(payload.threadId, 200) ??
      cleanString(payload.thread_id, 200) ??
      cleanString(parentThread?.id, 200) ??
      cleanString(sourceThread?.id, 200) ??
      cleanString(thread?.id, 200) ??
      parentSessionId,
    turnId:
      cleanString(payload.turnId, 200) ??
      cleanString(payload.turn_id, 200) ??
      cleanString(turn?.id, 200),
    projectPath,
    projectId:
      cleanString(payload.projectId, 160) ??
      cleanString(payload.project_id, 160) ??
      projectIdFromPath(projectPath),
  };
}

function collectRecords(value: unknown, output: JsonRecord[], depth = 0): void {
  if (depth > 5 || output.length > 120) return;
  if (Array.isArray(value)) {
    for (const item of value.slice(0, MAX_ARRAY_SCAN_ITEMS)) collectRecords(item, output, depth + 1);
    return;
  }
  if (!isRecord(value)) return;
  output.push(value);
  for (const [key, child] of Object.entries(value).slice(0, MAX_OBJECT_SCAN_KEYS)) {
    if (/^(prompt|content|transcript|stdout|stderr)$/i.test(key)) continue;
    if (/^output$/i.test(key) && typeof child === "string") continue;
    collectRecords(child, output, depth + 1);
  }
}

function childThreadIdFromRecords(records: JsonRecord[]): string | undefined {
  for (const [index, record] of records.entries()) {
    const direct =
      cleanString(record.childThreadId, 200) ??
      cleanString(record.child_thread_id, 200) ??
      cleanString(record.createdThreadId, 200) ??
      cleanString(record.created_thread_id, 200) ??
      cleanString(record.forkedThreadId, 200) ??
      cleanString(record.forked_thread_id, 200) ??
      (index === 0 ? undefined : cleanString(record.threadId, 200)) ??
      (index === 0 ? undefined : cleanString(record.thread_id, 200));
    if (direct) return direct;
    const thread = findFirstRecord(record.thread, record.childThread, record.createdThread, record.forkedThread);
    const nested = cleanString(thread?.id, 200) ?? cleanString(thread?.threadId, 200);
    if (nested) return nested;
  }
  return undefined;
}

function pendingWorktreeIdFromRecords(records: JsonRecord[]): string | undefined {
  for (const record of records) {
    const direct =
      cleanString(record.pendingWorktreeId, 200) ??
      cleanString(record.pending_worktree_id, 200) ??
      cleanString(record.worktreeId, 200) ??
      cleanString(record.worktree_id, 200);
    if (direct) return direct;
  }
  return undefined;
}

function titleFromRecords(records: JsonRecord[]): string | undefined {
  for (const record of records) {
    const direct =
      cleanString(record.title, 120) ??
      cleanString(record.threadTitle, 120) ??
      cleanString(record.thread_title, 120) ??
      cleanString(record.name, 120);
    if (direct) return direct;
  }
  return undefined;
}

function candidateHash(input: ThreadLineageCandidate): string {
  return createHash("sha1")
    .update(
      [
        input.eventName,
        input.sourceTool,
        input.parentThreadId ?? input.parentSessionId ?? "",
        input.childThreadId ?? input.pendingWorktreeId ?? "",
        input.turnId ?? "",
        String(Math.floor(input.occurredAt / 1000)),
      ].join("\n"),
    )
    .digest("hex")
    .slice(0, 16);
}

function buildEventKey(input: Omit<ThreadLineageCandidate, "eventKey">): string {
  const hash = candidateHash({ ...input, eventKey: "" });
  return [
    "thread-lineage",
    input.sourceTool,
    input.parentThreadId ?? input.parentSessionId ?? "parent",
    input.childThreadId ?? input.pendingWorktreeId ?? "child",
    hash,
  ]
    .join(":")
    .replace(/\s+/g, "-")
    .slice(0, 500);
}

export function parseThreadLineageEventsFromPayload(
  payload: unknown,
  now = Date.now(),
): ThreadLineageCandidate[] {
  if (!isRecord(payload)) return [];
  if (!/post.*tool.*use/i.test(resolveEventName(payload))) return [];
  const sourceTool = normalizeThreadToolName(resolveToolName(payload));
  if (!sourceTool) return [];

  const records: JsonRecord[] = [];
  collectRecords(payload, records);
  const childThreadId = childThreadIdFromRecords(records);
  const pendingWorktreeId = pendingWorktreeIdFromRecords(records);
  if (!childThreadId && !pendingWorktreeId) return [];

  const metadata = resolveMetadata(payload);
  const occurredAt = resolveOccurredAt(payload, now);
  const eventName: ThreadLineageEventName =
    sourceTool === "fork_thread" ? "thread.forked" : "thread.created";
  const candidate = {
    eventName,
    sourceTool,
    parentThreadId: metadata.parentThreadId,
    parentSessionId: metadata.parentSessionId,
    childThreadId,
    pendingWorktreeId,
    title: titleFromRecords(records),
    projectPath: metadata.projectPath,
    projectId: metadata.projectId,
    turnId: metadata.turnId,
    occurredAt,
  };
  return [{ ...candidate, eventKey: buildEventKey(candidate) }];
}

export function parseThreadLineageEventsFromStdin(
  stdin: string,
  now = Date.now(),
): ThreadLineageCandidate[] {
  try {
    return parseThreadLineageEventsFromPayload(JSON.parse(stdin), now);
  } catch {
    return [];
  }
}

export function buildThreadLineageTelemetryEnvelope(candidate: ThreadLineageCandidate) {
  return {
    hookName: "thread-lineage-listener",
    hookType: "PostToolUse",
    projectId: candidate.projectId,
    sessionId: candidate.parentSessionId ?? candidate.parentThreadId,
    payload: {
      eventName: candidate.eventName,
      toolName: candidate.sourceTool,
      parentThreadId: candidate.parentThreadId,
      parentSessionId: candidate.parentSessionId,
      childThreadId: candidate.childThreadId,
      pendingWorktreeId: candidate.pendingWorktreeId,
      title: candidate.title,
      cwd: candidate.projectPath,
      turnId: candidate.turnId,
    },
    eventAt: candidate.occurredAt,
    eventKey: candidate.eventKey,
  };
}

export async function publishThreadLineageEvents(
  candidates: ThreadLineageCandidate[],
  options: PublishThreadLineageOptions = {},
): Promise<{ attempted: number; published: number; skipped: boolean; queued?: number; replayed?: number }> {
  const primaryProjectPath = candidates.find((candidate) => candidate.projectPath)?.projectPath;
  return await publishHookTelemetryWithOutbox(
    candidates.map((candidate) => buildThreadLineageTelemetryEnvelope(candidate)),
    {
      endpointBaseUrl: options.endpointBaseUrl,
      telemetryToken: options.telemetryToken,
      fetchImpl: options.fetchImpl,
      projectPath: primaryProjectPath,
    },
  );
}

function readDotenvValue(filePath: string, key: string): string | undefined {
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

export function resolveDefaultEndpointBaseUrl(
  env: NodeJS.ProcessEnv = process.env,
  searchDirs: string[] = [],
): string {
  const configured = firstFarplaneConfigValue(["FARPLANE_CONVEX_SITE_URL", "CONVEX_SITE_URL"], { env });
  if (configured) return configured;
  for (const dir of searchDirs) {
    const value =
      readDotenvValue(path.join(dir, ".env.local"), "FARPLANE_CONVEX_SITE_URL") ??
      readDotenvValue(path.join(dir, ".env.local"), "CONVEX_SITE_URL");
    if (value) return value.trim();
  }
  return "";
}

export function resolveDefaultTelemetryToken(
  env: NodeJS.ProcessEnv = process.env,
  searchDirs: string[] = [],
): string {
  const configured = readFarplaneConfigValue("FARPLANE_TELEMETRY_TOKEN", { env, secret: true });
  if (configured) return configured;
  for (const dir of searchDirs) {
    const value = readDotenvValue(path.join(dir, ".env.local"), "FARPLANE_TELEMETRY_TOKEN");
    if (value) return value.trim();
  }
  return "";
}
