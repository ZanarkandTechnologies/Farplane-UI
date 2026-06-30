/**
 * HOOK TELEMETRY LEARNING TIMELINE
 * ================================
 * Ownership: Farplane UI hook telemetry projections.
 * Inputs/outputs: raw `hookTelemetryEvents` rows to compact learning/decision timeline rows.
 * Side effects: none.
 * Invariants: projection exposes curated metadata only and does not surface raw prompts/transcripts.
 */

import type { HookTelemetryRow } from "./projections";
import {
  isFarplaneFileEventName,
  isFarplaneFileEventPayload,
  type FarplaneFileEventName,
} from "./farplaneFileEvents";

type JsonRecord = Record<string, unknown>;

export type LearningTimelineEventName =
  | "ticket.audit.created"
  | "ticket.audit.scored"
  | "miner.window.updated"
  | "miner.agent.skipped"
  | "miner.agent.queued"
  | "miner.agent.launched"
  | "miner.agent.failed"
  | "miner.agent.completed"
  | "decision.observed"
  | "learning.lesson.observed"
  | "learning.trouble.observed"
  | FarplaneFileEventName;

export type LearningTimelineRow = {
  id: string;
  eventName: LearningTimelineEventName;
  projectId?: string;
  projectPath?: string;
  sessionId?: string;
  threadId?: string;
  turnId?: string;
  ticketId?: string;
  source?: string;
  sourceProgram?: string;
  status?: string;
  severity?: string;
  summary: string;
  decisionKind?: string;
  runId?: string;
  outputId?: string;
  reviewRunPath?: string;
  docsTarget?: string;
  rowsAdded?: number;
  sourceEventKey?: string;
  entityKind?: string;
  entityId?: string;
  changedFields?: string[];
  filePath?: string;
  eventAt: number;
  eventKey?: string;
};

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function cleanText(value: unknown, limit = 500): string | undefined {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed ? trimmed.slice(0, limit) : undefined;
}

function number(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function eventNameFromPayload(payload: JsonRecord): LearningTimelineEventName | undefined {
  const explicit = cleanText(payload.eventName, 120) ?? cleanText(payload.eventType, 120) ?? cleanText(payload.type, 120);
  if (
    explicit === "decision.observed" ||
    explicit === "ticket.audit.created" ||
    explicit === "ticket.audit.scored" ||
    explicit === "miner.window.updated" ||
    explicit === "miner.agent.skipped" ||
    explicit === "miner.agent.queued" ||
    explicit === "miner.agent.launched" ||
    explicit === "miner.agent.failed" ||
    explicit === "miner.agent.completed" ||
    explicit === "learning.lesson.observed" ||
    explicit === "learning.trouble.observed" ||
    isFarplaneFileEventName(explicit)
  ) {
    return explicit;
  }
  return undefined;
}

function threadIdFromRow(row: HookTelemetryRow, payload: JsonRecord): string | undefined {
  return (
    cleanText(payload.threadId, 200) ??
    cleanText(payload.thread_id, 200) ??
    cleanText(row.sessionId, 200) ??
    cleanText(payload.sessionId, 200) ??
    cleanText(payload.session_id, 200)
  );
}

function projectPathFromPayload(payload: JsonRecord): string | undefined {
  return cleanText(payload.cwd, 300) ?? cleanText(payload.projectPath, 300) ?? cleanText(payload.projectDirectory, 300);
}

function projectIdFromRow(row: HookTelemetryRow, payload: JsonRecord): string | undefined {
  return row.projectId ?? cleanText(payload.projectId, 160) ?? cleanText(payload.project_id, 160);
}

function docsDeltaTarget(payload: JsonRecord): string | undefined {
  const docsDelta = asRecord(payload.docsDelta);
  return cleanText(docsDelta.target, 200) ?? cleanText(payload.docsTarget, 200);
}

function docsDeltaRowsAdded(payload: JsonRecord): number | undefined {
  const docsDelta = asRecord(payload.docsDelta);
  return number(docsDelta.rowsAdded) ?? number(payload.rowsAdded);
}

function changedFieldPaths(payload: JsonRecord): string[] | undefined {
  const rawFields = Array.isArray(payload.changedFields) ? payload.changedFields : [];
  const fields = rawFields
    .map((field) => {
      const record = asRecord(field);
      return cleanText(record.path, 160);
    })
    .filter((field): field is string => Boolean(field))
    .slice(0, 12);
  return fields.length ? fields : undefined;
}

export function hookTelemetryRowsToLearningTimelineRows(rows: HookTelemetryRow[]): LearningTimelineRow[] {
  const timeline = rows
    .map((row): LearningTimelineRow | null => {
      const payload = asRecord(row.payload);
      if (isFarplaneFileEventPayload(row.payload)) {
        const summary = cleanText(row.payload.summary, 140);
        if (!summary) return null;
        return {
          id: row.eventKey ?? row.payload.eventKey,
          eventName: row.payload.eventName,
          projectId: row.projectId ?? row.payload.projectId,
          projectPath: projectPathFromPayload(payload),
          sessionId: row.sessionId ?? row.payload.sessionId,
          threadId: row.payload.threadId ?? row.payload.sessionId ?? row.sessionId,
          ticketId: row.payload.entityKind === "ticket" ? row.payload.entityId : undefined,
          source: row.payload.source,
          summary,
          sourceEventKey: row.eventKey ?? row.payload.eventKey,
          entityKind: row.payload.entityKind,
          entityId: row.payload.entityId,
          changedFields: row.payload.changedFields?.map((field) => field.path).slice(0, 12),
          filePath: row.payload.path,
          eventAt: row.eventAt,
          eventKey: row.eventKey,
        };
      }
      const eventName = eventNameFromPayload(payload);
      if (!eventName) return null;
      const summary =
        cleanText(payload.message, 140) ??
        cleanText(payload.summary, 140) ??
        cleanText(payload.title, 140) ??
        cleanText(payload.statusText, 140);
      if (!summary) return null;
      return {
        id: row.eventKey ?? row._id ?? `${eventName}:${row.sessionId ?? "session"}:${row.eventAt}`,
        eventName,
        projectId: projectIdFromRow(row, payload),
        projectPath: projectPathFromPayload(payload),
        sessionId: row.sessionId ?? cleanText(payload.sessionId, 200),
        threadId: threadIdFromRow(row, payload),
        turnId: cleanText(payload.turnId, 200) ?? cleanText(payload.turn_id, 200),
        ticketId: cleanText(payload.ticketId, 80) ?? cleanText(payload.ticket_id, 80),
        source: cleanText(payload.source, 120),
        sourceProgram: cleanText(payload.sourceProgram, 120),
        status: cleanText(payload.status, 80),
        severity: cleanText(payload.severity, 80),
        summary,
        decisionKind: cleanText(payload.decisionKind, 80),
        runId: cleanText(payload.runId, 160),
        outputId: cleanText(payload.outputId, 160),
        reviewRunPath: cleanText(payload.reviewRunPath, 240),
        docsTarget: docsDeltaTarget(payload),
        rowsAdded: docsDeltaRowsAdded(payload),
        sourceEventKey: cleanText(payload.sourceEventKey, 240) ?? row.eventKey,
        entityKind: cleanText(payload.entityKind, 80),
        entityId: cleanText(payload.entityId, 160),
        changedFields: changedFieldPaths(payload),
        filePath: cleanText(payload.path, 240),
        eventAt: row.eventAt,
        eventKey: row.eventKey,
      };
    })
    .filter((row): row is LearningTimelineRow => row !== null);
  return fillMinerReportTicketIds(timeline)
    .sort((left, right) => right.eventAt - left.eventAt || left.id.localeCompare(right.id));
}

function fillMinerReportTicketIds(rows: LearningTimelineRow[]): LearningTimelineRow[] {
  const ticketByReviewRunPath = new Map<string, string>();
  for (const row of rows) {
    if (row.reviewRunPath && row.ticketId) ticketByReviewRunPath.set(row.reviewRunPath, row.ticketId);
  }
  return rows.map((row) => {
    if (
      row.ticketId ||
      (row.eventName !== "miner.agent.completed" && row.eventName !== "miner.agent.failed") ||
      !row.reviewRunPath
    ) {
      return row;
    }
    const ticketId = ticketByReviewRunPath.get(row.reviewRunPath);
    return ticketId ? { ...row, ticketId } : row;
  });
}
