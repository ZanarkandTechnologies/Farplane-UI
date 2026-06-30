/**
 * TICKET COMPLETION PACKET
 * ========================
 * Ownership: local mining server.
 * Inputs: a completed ticket mining source plus project-local ticket/session artifacts.
 * Outputs: bounded packet JSON/Markdown for ticket-completion audit scorecards.
 * Side effects: read-only filesystem scans under the project root.
 * Invariants: full raw transcripts are referenced, not copied, by default.
 */
import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { isSafeMiningFileId, type JsonObject, type MiningThreadSource } from "./mining-sources";

export type TicketCompletionMetric = {
  id: string;
  label: string;
  status: "known" | "unknown";
  value?: number | string;
  unit?: string;
  confidence: "low" | "medium" | "high";
  evidenceRefs: string[];
  reason?: string;
};

export type TicketCompletionPacket = {
  schemaVersion: 1;
  packetKind: "ticket_completion";
  runId: string;
  sourceEventKey?: string;
  ticketId?: string;
  sessionId?: string;
  threadId?: string;
  projectPath: string;
  ticketFolder?: string;
  source: {
    id: string;
    name: string;
    preview: string;
    inputRef?: string;
    sourceKind?: string;
    updatedAt?: number;
  };
  files: Array<{
    id: string;
    path: string;
    exists: boolean;
    hash?: string;
    lineCount?: number;
    frontmatter?: Record<string, string>;
    headings?: string[];
    snippet?: string;
    missingReason?: string;
  }>;
  artifacts: Array<{
    path: string;
    kind: "file" | "directory";
    bytes?: number;
  }>;
  decisions: Array<{
    eventName?: string;
    sourceProgram?: string;
    ticketId?: string;
    sessionId?: string;
    summary?: string;
    reviewRunPath?: string;
  }>;
  transcript: {
    sessionId?: string;
    threadId?: string;
    transcriptRef?: string;
    boundedWindow: Array<{
      role: "user" | "assistant" | "summary" | "unknown";
      text: string;
      capturedAt?: string;
      sourcePath: string;
      jsonPointer: string;
    }>;
    unavailableReason?: string;
    fullTranscriptPolicy: "reference_only";
  };
  metrics: TicketCompletionMetric[];
  warnings: string[];
  createdAt: string;
};

const FILE_SNIPPET_LIMIT = 2_000;
const TRANSCRIPT_SNIPPET_LIMIT = 700;
const MAX_TRANSCRIPT_ROWS = 8;
const MAX_DECISION_ROWS = 12;

function clip(value: string | undefined, max: number): string {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}...` : text;
}

function hashText(value: string): string {
  return createHash("sha1").update(value).digest("hex").slice(0, 16);
}

function metric(input: Omit<TicketCompletionMetric, "confidence"> & { confidence?: TicketCompletionMetric["confidence"] }): TicketCompletionMetric {
  return {
    confidence: input.confidence ?? (input.status === "known" ? "medium" : "low"),
    ...input,
  };
}

function parseFrontmatter(text: string): Record<string, string> | undefined {
  if (!text.startsWith("---\n") && !text.startsWith("---\r\n")) return undefined;
  const end = text.indexOf("\n---", 4);
  if (end < 0) return undefined;
  const raw: Record<string, string> = {};
  for (const line of text.slice(3, end).split(/\r?\n/g)) {
    if (!line.trim() || /^\s/.test(line)) continue;
    const match = line.match(/^([A-Za-z0-9_.-]+):\s*(.*)$/);
    if (!match?.[1]) continue;
    raw[match[1].trim()] = (match[2] ?? "").replace(/^['"]|['"]$/g, "").trim();
  }
  return Object.keys(raw).length ? raw : undefined;
}

function parseHeadings(text: string): string[] {
  return text
    .split(/\r?\n/g)
    .map((line) => line.match(/^(#{1,6})\s+(.+)$/)?.[2]?.trim())
    .filter((heading): heading is string => Boolean(heading))
    .slice(0, 10);
}

function parseDateLike(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

async function readOptionalText(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf-8");
  } catch {
    return null;
  }
}

async function buildFileEntry(projectPath: string, relativePath: string): Promise<TicketCompletionPacket["files"][number]> {
  const absolutePath = path.join(projectPath, relativePath);
  const text = await readOptionalText(absolutePath);
  if (text === null) {
    return {
      id: relativePath,
      path: relativePath,
      exists: false,
      missingReason: "file_not_found",
    };
  }
  return {
    id: relativePath,
    path: relativePath,
    exists: true,
    hash: hashText(text),
    lineCount: text.split(/\r?\n/g).length,
    frontmatter: parseFrontmatter(text),
    headings: parseHeadings(text),
    snippet: text.slice(0, FILE_SNIPPET_LIMIT),
  };
}

async function listArtifacts(projectPath: string, ticketId: string | undefined): Promise<TicketCompletionPacket["artifacts"]> {
  if (!ticketId || !isSafeMiningFileId(ticketId)) return [];
  const root = path.join(projectPath, "tickets", ticketId, "artifacts");
  let entries: string[] = [];
  try {
    entries = await readdir(root);
  } catch {
    return [];
  }
  const artifacts: TicketCompletionPacket["artifacts"] = [];
  for (const entry of entries.slice(0, 40)) {
    const absolutePath = path.join(root, entry);
    try {
      const info = await stat(absolutePath);
      artifacts.push({
        path: path.join("tickets", ticketId, "artifacts", entry).replace(/\\/g, "/"),
        kind: info.isDirectory() ? "directory" : "file",
        bytes: info.isFile() ? info.size : undefined,
      });
    } catch {
      // Skip disappearing artifact rows.
    }
  }
  return artifacts.sort((left, right) => left.path.localeCompare(right.path));
}

function jsonRecord(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};
}

function parseJsonObject(raw: string | null): JsonObject {
  if (!raw) return {};
  try {
    return jsonRecord(JSON.parse(raw));
  } catch {
    return {};
  }
}

async function findMinedDecisions(input: {
  projectPath: string;
  ticketId?: string;
  sessionId?: string;
}): Promise<TicketCompletionPacket["decisions"]> {
  const root = path.join(input.projectPath, ".farplane", "event-miner", "runs");
  let runDirs: string[] = [];
  try {
    runDirs = await readdir(root);
  } catch {
    return [];
  }
  const rows: TicketCompletionPacket["decisions"] = [];
  for (const dir of runDirs.slice(-80)) {
    const report = parseJsonObject(await readOptionalText(path.join(root, dir, "report.json")));
    const events = Array.isArray(report.events) ? report.events : [];
    for (const rawEvent of events) {
      const event = jsonRecord(rawEvent);
      const eventTicketId = typeof event.ticketId === "string" ? event.ticketId : undefined;
      const eventSessionId = typeof event.sessionId === "string" ? event.sessionId : typeof report.sessionId === "string" ? report.sessionId : undefined;
      if (input.ticketId && eventTicketId !== input.ticketId) continue;
      if (!input.ticketId && input.sessionId && eventSessionId !== input.sessionId) continue;
      rows.push({
        eventName: typeof event.eventName === "string" ? event.eventName : undefined,
        sourceProgram: typeof event.sourceProgram === "string" ? event.sourceProgram : undefined,
        ticketId: eventTicketId,
        sessionId: eventSessionId,
        summary: typeof event.summary === "string" ? event.summary : undefined,
        reviewRunPath: `.farplane/event-miner/runs/${dir}/report.json`,
      });
      if (rows.length >= MAX_DECISION_ROWS) return rows;
    }
  }
  return rows;
}

function pushTranscriptRow(
  rows: TicketCompletionPacket["transcript"]["boundedWindow"],
  input: {
    role: "user" | "assistant" | "summary" | "unknown";
    text: unknown;
    capturedAt?: unknown;
    sourcePath: string;
    jsonPointer: string;
  },
): void {
  if (rows.length >= MAX_TRANSCRIPT_ROWS || typeof input.text !== "string") return;
  const text = clip(input.text, TRANSCRIPT_SNIPPET_LIMIT);
  if (!text) return;
  rows.push({
    role: input.role,
    text,
    capturedAt: typeof input.capturedAt === "string" ? input.capturedAt : undefined,
    sourcePath: input.sourcePath,
    jsonPointer: input.jsonPointer,
  });
}

async function resolveTranscriptContext(input: {
  projectPath: string;
  sessionId?: string;
  threadId?: string;
}): Promise<TicketCompletionPacket["transcript"]> {
  const id = input.sessionId ?? input.threadId;
  const transcript: TicketCompletionPacket["transcript"] = {
    sessionId: input.sessionId,
    threadId: input.threadId,
    transcriptRef: id ? `codex-session:${id}` : undefined,
    boundedWindow: [],
    fullTranscriptPolicy: "reference_only",
  };
  if (!id || !isSafeMiningFileId(id)) {
    return { ...transcript, unavailableReason: id ? "unsafe_session_id" : "session_id_missing" };
  }
  const sourcePath = path.join(input.projectPath, ".farplane", "state", "message-windows", `${id}.json`);
  const raw = await readOptionalText(sourcePath);
  if (raw === null) return { ...transcript, unavailableReason: "message_window_not_found" };
  const summary = parseJsonObject(raw);
  const pending = jsonRecord(summary.pending_user_turn);
  pushTranscriptRow(transcript.boundedWindow, {
    role: "user",
    text: pending.user_text,
    capturedAt: pending.user_captured_at,
    sourcePath,
    jsonPointer: "/pending_user_turn/user_text",
  });
  const exchanges = Array.isArray(summary.rolling_exchanges) ? summary.rolling_exchanges : [];
  exchanges.slice(-4).forEach((entry, offset) => {
    const row = jsonRecord(entry);
    const index = Math.max(0, exchanges.length - 4) + offset;
    pushTranscriptRow(transcript.boundedWindow, {
      role: "user",
      text: row.user_text,
      capturedAt: row.user_captured_at,
      sourcePath,
      jsonPointer: `/rolling_exchanges/${index}/user_text`,
    });
    pushTranscriptRow(transcript.boundedWindow, {
      role: "assistant",
      text: row.assistant_text,
      capturedAt: row.assistant_captured_at,
      sourcePath,
      jsonPointer: `/rolling_exchanges/${index}/assistant_text`,
    });
  });
  return transcript.boundedWindow.length
    ? transcript
    : { ...transcript, unavailableReason: "message_window_empty" };
}

function metricFromCount(input: {
  id: string;
  label: string;
  value: number;
  unit: string;
  evidenceRefs: string[];
  confidence?: TicketCompletionMetric["confidence"];
}): TicketCompletionMetric {
  return metric({
    id: input.id,
    label: input.label,
    status: "known",
    value: input.value,
    unit: input.unit,
    evidenceRefs: input.evidenceRefs,
    confidence: input.confidence ?? "high",
  });
}

function deriveMetrics(input: {
  files: TicketCompletionPacket["files"];
  artifacts: TicketCompletionPacket["artifacts"];
  decisions: TicketCompletionPacket["decisions"];
  transcript: TicketCompletionPacket["transcript"];
  source: MiningThreadSource;
}): TicketCompletionMetric[] {
  const ticketFile = input.files.find((file) => file.path.endsWith("ticket.md"));
  const progressFile = input.files.find((file) => file.path.endsWith("progress.md"));
  const progressLines = progressFile?.snippet
    ?.split(/\r?\n/g)
    .filter((line) => /^\s*[-*]\s+/.test(line)).length ?? 0;
  const createdAt = parseDateLike(ticketFile?.frontmatter?.created_at);
  const completedAt =
    typeof input.source.updatedAt === "number" && input.source.updatedAt > 0
      ? input.source.updatedAt * 1000
      : parseDateLike(ticketFile?.frontmatter?.updated_at);
  return [
    createdAt && completedAt
      ? metric({
          id: "time_to_complete",
          label: "Time to complete",
          status: "known",
          value: Math.max(0, Math.round((completedAt - createdAt) / 60_000)),
          unit: "minutes",
          confidence: "medium",
          evidenceRefs: ["ticket.frontmatter.created_at", "source.updatedAt"],
        })
      : metric({
          id: "time_to_complete",
          label: "Time to complete",
          status: "unknown",
          unit: "minutes",
          confidence: "low",
          evidenceRefs: ["ticket.frontmatter"],
          reason: "created_at or completion event timestamp unavailable",
        }),
    metricFromCount({
      id: "proof_artifact_count",
      label: "Proof artifact count",
      value: input.artifacts.filter((artifact) => artifact.kind === "file").length,
      unit: "files",
      evidenceRefs: ["ticket.artifacts"],
    }),
    metricFromCount({
      id: "progress_bullet_count",
      label: "Progress bullet count",
      value: progressLines,
      unit: "bullets",
      evidenceRefs: progressFile?.exists ? [progressFile.path] : [],
      confidence: progressFile?.exists ? "medium" : "low",
    }),
    metricFromCount({
      id: "decision_event_count",
      label: "Mined decision event count",
      value: input.decisions.length,
      unit: "events",
      evidenceRefs: input.decisions.map((decision) => decision.reviewRunPath ?? "event-miner").slice(0, 5),
      confidence: "medium",
    }),
    metricFromCount({
      id: "transcript_window_rows",
      label: "Bounded transcript rows",
      value: input.transcript.boundedWindow.length,
      unit: "rows",
      evidenceRefs: input.transcript.boundedWindow.length ? ["transcript.boundedWindow"] : [],
      confidence: input.transcript.boundedWindow.length ? "medium" : "low",
    }),
    metric({
      id: "turns_taken",
      label: "Turns taken",
      status: "unknown",
      unit: "turns",
      confidence: "low",
      evidenceRefs: ["hookTelemetryEvents"],
      reason: "local packet builder does not have a complete telemetry window yet",
    }),
    metric({
      id: "token_usage",
      label: "Token usage",
      status: "unknown",
      unit: "tokens",
      confidence: "low",
      evidenceRefs: ["codex-session-usage"],
      reason: "Codex session token usage is not reliably available in local artifacts",
    }),
  ];
}

export async function buildTicketCompletionPacket(input: {
  projectPath: string;
  runId: string;
  source: MiningThreadSource;
  sourceEventKey?: string;
  now?: () => Date;
}): Promise<TicketCompletionPacket> {
  const ticketId = input.source.ticketId ?? input.source.id.match(/\bTASK-\d{4}\b/i)?.[0]?.toUpperCase();
  const ticketFolder = ticketId && isSafeMiningFileId(ticketId) ? path.join("tickets", ticketId) : undefined;
  const files = ticketFolder
    ? await Promise.all(
        ["ticket.md", "program.md", "progress.md"].map((fileName) =>
          buildFileEntry(input.projectPath, path.join(ticketFolder, fileName).replace(/\\/g, "/")),
        ),
      )
    : [];
  const artifacts = await listArtifacts(input.projectPath, ticketId);
  const transcript = await resolveTranscriptContext({
    projectPath: input.projectPath,
    sessionId: input.source.sessionId,
    threadId: input.source.threadId ?? input.source.id,
  });
  const decisions = await findMinedDecisions({
    projectPath: input.projectPath,
    ticketId,
    sessionId: input.source.sessionId,
  });
  const warnings = [
    ...(ticketId ? [] : ["ticket_id_missing"]),
    ...(transcript.unavailableReason ? [`transcript_${transcript.unavailableReason}`] : []),
  ];
  return {
    schemaVersion: 1,
    packetKind: "ticket_completion",
    runId: input.runId,
    sourceEventKey: input.sourceEventKey,
    ticketId,
    sessionId: input.source.sessionId,
    threadId: input.source.threadId ?? input.source.id,
    projectPath: input.projectPath,
    ticketFolder,
    source: {
      id: input.source.id,
      name: input.source.name,
      preview: input.source.preview,
      inputRef: input.source.inputRef,
      sourceKind: input.source.sourceKind,
      updatedAt: input.source.updatedAt,
    },
    files,
    artifacts,
    decisions,
    transcript,
    metrics: deriveMetrics({ artifacts, decisions, files, source: input.source, transcript }),
    warnings,
    createdAt: (input.now ?? (() => new Date()))().toISOString(),
  };
}
