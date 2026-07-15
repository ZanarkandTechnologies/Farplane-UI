/**
 * LOCAL OBSERVED CODEX WORKERS
 * ============================
 * Pure mapper for turning local Farplane hook JSONL rows into the same
 * read-only observed Codex workers used by Convex-backed hook telemetry.
 *
 * Inputs: parsed rows from ~/.farplane/events/*.jsonl.
 * Outputs: deduped ObservedCodexWorkerRow records.
 * Side effects: none; filesystem reads live in the Vite state bridge.
 */

import {
  codexProjectIdFromDirectory,
  type HookTelemetryRow,
  hookTelemetryRowsToObservedCodexWorkers,
  type ObservedCodexTitleSource,
  type ObservedCodexWorker as ObservedCodexWorkerRow,
  observedCodexTitlePriority,
} from "../../../convex/modules/hookTelemetry/projections";

export type { ObservedCodexTitleSource, ObservedCodexWorkerRow };
export { observedCodexTitlePriority };

export const LOCAL_OBSERVED_CODEX_DISCOVERY_RANGE_MS = 5 * 60 * 1000;

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function eventTime(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function safeIdPart(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9_.:-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120) || "unknown"
  );
}

function projectIdFromLocalRow(row: JsonRecord): string | undefined {
  const explicit = text(row.project_id) ?? text(row.projectId);
  if (explicit) return explicit;
  const projectRoot = text(row.project_root) ?? text(row.projectRoot);
  if (projectRoot) return codexProjectIdFromDirectory(projectRoot);
  const projectName = text(row.project_name) ?? text(row.projectName);
  if (projectName) return `codex-proj-${safeIdPart(projectName)}`;
  return undefined;
}

function hookTypeFromLocalRow(row: JsonRecord): string | undefined {
  const explicit = text(row.hookType);
  if (explicit) return explicit;
  const hookName = text(row.hook_name) ?? text(row.hookName);
  if (!hookName) return undefined;
  if (hookName === "UserPromptSubmit") return "UserPromptSubmit";
  if (hookName === "Stop") return "Stop";
  if (hookName === "TurnStart" || hookName === "TurnEnd" || hookName === "Heartbeat")
    return hookName;
  return hookName;
}

function localRowToHookTelemetryRow(value: unknown): HookTelemetryRow | null {
  const row = asRecord(value);
  const metadata = asRecord(row.metadata);
  const hookName = text(row.hook_name) ?? text(row.hookName) ?? text(row.source);
  const hookType = hookTypeFromLocalRow(row);
  const eventAt = eventTime(row.timestamp ?? row.eventAt ?? row.receivedAt);
  if (!hookName || !hookType || !eventAt) return null;

  const sessionId = text(row.session_id) ?? text(row.sessionId);
  const turnId = text(row.turn_id) ?? text(row.turnId);
  const summary = text(row.summary);
  const projectRoot = text(row.project_root) ?? text(row.projectRoot);
  const cwd = text(metadata.cwd) ?? projectRoot;
  const hostname = text(metadata.hostname) ?? text(metadata.hostName);
  const workerName = text(metadata.worker_name) ?? text(metadata.workerName);
  const sessionName = text(metadata.session_name) ?? text(metadata.sessionName);

  return {
    hookName,
    hookType,
    projectId: projectIdFromLocalRow(row),
    sessionId,
    eventAt,
    eventKey: text(row.event_id) ?? text(row.eventKey),
    payload: {
      ...metadata,
      cwd,
      projectPath: projectRoot ?? cwd,
      projectName: text(row.project_name) ?? text(row.projectName),
      sessionId,
      session_id: sessionId,
      turnId,
      turn_id: turnId,
      threadId: text(row.thread_id) ?? text(row.threadId) ?? sessionId,
      eventType: text(row.event_type) ?? text(row.eventType),
      summary,
      statusText: summary,
      message: summary,
      machineName: hostname,
      hostname,
      agentName: workerName || sessionName,
    },
  };
}

export function localFarplaneEventsToObservedCodexWorkers(
  rows: unknown[],
  options: {
    now?: number;
    rangeMs?: number;
    limit?: number;
  } = {},
): ObservedCodexWorkerRow[] {
  const now = options.now ?? Date.now();
  const rangeMs = options.rangeMs ?? LOCAL_OBSERVED_CODEX_DISCOVERY_RANGE_MS;
  const cutoff = now - rangeMs;
  const limit = Math.max(1, Math.min(options.limit ?? 500, 1000));
  const telemetryRows = rows
    .map(localRowToHookTelemetryRow)
    .filter((row): row is HookTelemetryRow => row !== null)
    .filter((row) => row.eventAt >= cutoff);

  return hookTelemetryRowsToObservedCodexWorkers(telemetryRows).slice(0, limit);
}
