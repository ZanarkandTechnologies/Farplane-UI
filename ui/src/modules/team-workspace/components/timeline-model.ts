/**
 * Timeline tab model helpers.
 * Owns hook telemetry row conversion, clustering, date labels, and event-miner report parsing.
 */

import type { TeamTimelineRow } from "./team-timeline";

export type TimelineCluster = {
  id: string;
  latest: TeamTimelineRow;
  previous: TeamTimelineRow[];
};

export type TimelineGroup = {
  label: string;
  clusters: TimelineCluster[];
};

export type LearningTimelineResponse = {
  rows: LearningTimelineRow[];
};

export type LearningTimelineRow = {
  id: string;
  eventName: string;
  projectId?: string;
  projectPath?: string;
  sessionId?: string;
  threadId?: string;
  ticketId?: string;
  summary: string;
  status?: string;
  severity?: string;
  reviewRunPath?: string;
  runId?: string;
  outputId?: string;
  sourceProgram?: string;
  entityKind?: string;
  entityId?: string;
  changedFields?: string[];
  filePath?: string;
  eventAt: number;
};

export type EventMinerReportResponse = {
  ok: boolean;
  detail?: EventMinerReportDetail | null;
  error?: string;
};

export type EventMinerReportDetail = {
  runId: string;
  reportPath?: string;
  report?: unknown;
};

export type EventMinerReportState =
  | { runId: string | null; status: "idle" | "loading" }
  | { runId: string; status: "loaded"; detail: EventMinerReportDetail }
  | { runId: string; status: "error"; error: string };

export type EventMinerReport = {
  status: string;
  observed?: number;
  summary: string;
  ticketId?: string;
  events: EventMinerReportEvent[];
};

export type EventMinerReportEvent = {
  eventName: string;
  summary: string;
  severity?: string;
};

export function groupTimelineClusters(rows: TeamTimelineRow[]): TimelineGroup[] {
  const groups = new Map<string, TimelineCluster[]>();
  for (const cluster of clusterTimelineRows(rows)) {
    const label = formatDay(cluster.latest.occurredAt);
    groups.set(label, [...(groups.get(label) ?? []), cluster]);
  }
  return [...groups.entries()].map(([label, clusters]) => ({ label, clusters }));
}

function clusterTimelineRows(rows: TeamTimelineRow[]): TimelineCluster[] {
  const ticketRows = new Map<string, TeamTimelineRow[]>();
  const standalone: TimelineCluster[] = [];
  for (const row of rows) {
    const ticketKey = row.taskId?.trim();
    if (!ticketKey) {
      standalone.push({ id: row._id, latest: row, previous: [] });
      continue;
    }
    ticketRows.set(ticketKey, [...(ticketRows.get(ticketKey) ?? []), row]);
  }
  const ticketClusters = [...ticketRows.entries()].map(([ticketId, ticketEvents]) => {
    const sorted = [...ticketEvents].sort((left, right) => right.occurredAt - left.occurredAt);
    const [latest, ...previous] = sorted;
    return { id: `ticket:${ticketId}`, latest, previous };
  });
  return [...ticketClusters, ...standalone].sort(
    (left, right) => right.latest.occurredAt - left.latest.occurredAt || left.id.localeCompare(right.id),
  );
}

function formatDay(value: number): string {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatTime(value: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatDateTime(value: number): string {
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function codexProjectIdFromPath(projectPath: string): string {
  const slug = projectPath
    .trim()
    .replace(/\/+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `codex-proj-${slug || "codex"}`;
}

export function learningRowToTeamTimelineRow(
  row: LearningTimelineRow,
  fallbackProjectId: string,
): TeamTimelineRow {
  return {
    _id: row.id,
    sourceType: "hook_event",
    occurredAt: row.eventAt,
    projectId: row.projectId ?? fallbackProjectId,
    projectPath: row.projectPath,
    eventType: row.eventName,
    label: compactTimelineLabel(row),
    detail: compactTimelineDetail(row),
    taskId: row.ticketId ?? (row.entityKind === "ticket" ? row.entityId : undefined),
    sourcePath: row.filePath,
    reviewRunPath: row.reviewRunPath,
    runId: row.runId ?? runIdFromReviewPath(row.reviewRunPath),
    outputId: row.outputId ?? outputIdFromReviewPath(row.reviewRunPath),
    sourceProgram: row.sourceProgram,
    sessionId: row.sessionId ?? row.threadId,
    changedFields: row.changedFields,
  };
}

export function compactEventType(value: string): string {
  return value
    .replace(/^farplane\./, "")
    .replace(/^ticket\.audit\./, "audit.")
    .replace(/\.changed$/, " changed")
    .replace(/\.completed$/, " completed")
    .replace(/\./g, " ");
}

function compactTimelineLabel(row: LearningTimelineRow): string {
  if (row.eventName === "farplane.ticket.completed") {
    return `${row.ticketId ?? row.entityId ?? "Ticket"} completed`;
  }
  if (row.eventName === "ticket.audit.scored") {
    return `${row.ticketId ?? row.entityId ?? "Ticket"} mined eval`;
  }
  if (row.eventName === "miner.agent.completed" && row.ticketId) {
    return `${row.ticketId} miner completed`;
  }
  if (row.eventName === "ticket.audit.created" || row.eventName === "ticket.audit.scored") {
    return `${row.ticketId ?? row.entityId ?? "Ticket"} audit ready`;
  }
  return row.summary;
}

function compactTimelineDetail(row: LearningTimelineRow): string | undefined {
  const parts = [
    row.summary !== compactTimelineLabel(row) ? row.summary : undefined,
    row.sourceProgram,
    row.runId ? `Run: ${row.runId}` : undefined,
    row.outputId ? `Output: ${row.outputId}` : undefined,
    row.reviewRunPath ? `Report: ${row.reviewRunPath}` : undefined,
    row.filePath,
    row.status,
    row.severity ? `severity ${row.severity}` : undefined,
  ].filter((part): part is string => Boolean(part));
  return parts.length ? parts.join(" · ") : undefined;
}

function runIdFromReviewPath(value: string | undefined): string | undefined {
  return value?.match(/\.farplane\/mine\/runs\/([^/]+)/)?.[1];
}

function outputIdFromReviewPath(value: string | undefined): string | undefined {
  return value?.match(/\.farplane\/mine\/runs\/[^/]+\/outputs\/([^/]+)/)?.[1];
}

export function eventMinerRunIdFromReviewPath(value: string | undefined): string | undefined {
  return value?.match(/\.farplane\/event-miner\/runs\/([^/]+)/)?.[1];
}

export function eventMinerReportUrl(runId: string, projectPath: string | undefined): string {
  const params = new URLSearchParams();
  if (projectPath) params.set("projectPath", projectPath);
  const suffix = params.toString();
  return `/farplane/event-miner/runs/${encodeURIComponent(runId)}${suffix ? `?${suffix}` : ""}`;
}

export function normalizeEventMinerReport(value: unknown): EventMinerReport | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const summary = compactString(row.summary) ?? compactString(row.reason) ?? "Miner report completed.";
  const rawEvents = Array.isArray(row.events) ? row.events : [];
  return {
    status: compactString(row.status) ?? "completed",
    observed: typeof row.observed === "number" ? row.observed : undefined,
    summary,
    ticketId: compactString(row.ticketId) ?? undefined,
    events: rawEvents
      .map((event): EventMinerReportEvent | null => {
        if (!event || typeof event !== "object" || Array.isArray(event)) return null;
        const eventRow = event as Record<string, unknown>;
        const eventName = compactString(eventRow.eventName);
        const eventSummary = compactString(eventRow.summary);
        if (!eventName || !eventSummary) return null;
        return {
          eventName,
          summary: eventSummary,
          severity: compactString(eventRow.severity) ?? undefined,
        };
      })
      .filter((event): event is EventMinerReportEvent => Boolean(event)),
  };
}

function compactString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.replace(/\s+/g, " ").trim() : null;
}
