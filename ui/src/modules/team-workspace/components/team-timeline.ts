/**
 * TEAM TIMELINE HELPERS
 * =====================
 * Shared normalization for team timeline UI rows.
 * Inputs: project memory documents, Convex activity rows, and communication fallback rows.
 * Outputs: one sorted project event spine for the Team Panel Timeline tab.
 */

import type { TeamMemoryRow } from "./team-panel-types";

export type CommunicationRow = {
  id: string;
  agentId: string;
  activityType: string;
  label: string;
  detail?: string;
  occurredAt: number;
  taskId?: string;
};

export type TeamTimelineRow = {
  _id: string;
  sourceType: "board_event" | "agent_event" | "memory_event" | "hook_event" | "report_event";
  occurredAt: number;
  projectId: string;
  projectPath?: string;
  agentId?: string;
  actorAgentId?: string;
  activityType?: string;
  eventType?: string;
  label: string;
  detail?: string;
  taskId?: string;
  sourcePath?: string;
  sourceHref?: string;
  memoryId?: string;
  reviewRunPath?: string;
  reportKind?: string;
  reportRef?: string;
  runId?: string;
  outputId?: string;
  sourceProgram?: string;
  sessionId?: string;
  changedFields?: string[];
};

const HISTORY_ROW_PATTERN =
  /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2})(?:\s+([+-]\d{4}))?)?\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|\s*(.+)$/;

function parseTimelineDate(date: string, time?: string, offset?: string): number {
  const normalizedOffset = offset ? `${offset.slice(0, 3)}:${offset.slice(3)}` : "";
  const timestamp = Date.parse(`${date}T${time ?? "12:00"}:00${normalizedOffset}`);
  if (Number.isFinite(timestamp)) return timestamp;
  return Date.parse(`${date}T12:00:00`);
}

function buildMemoryTimelineRows(
  memoryRows: TeamMemoryRow[],
  projectId: string | undefined,
): TeamTimelineRow[] {
  const rows: TeamTimelineRow[] = [];
  for (const memory of memoryRows) {
    const sourcePath = memory.sourcePath ?? memory.title ?? memory.id;
    for (const [lineIndex, rawLine] of memory.body.split(/\r?\n/g).entries()) {
      const line = rawLine.trim();
      if (!line) continue;
      const historyMatch = line.match(HISTORY_ROW_PATTERN);
      if (!historyMatch) continue;
      const [, date, time, offset, eventType, memoryId, tags, label] = historyMatch;
      rows.push({
        _id: `${memory.id}:${lineIndex}`,
        sourceType: "memory_event",
        occurredAt: parseTimelineDate(date, time, offset),
        projectId: projectId ?? memory.projectId,
        eventType: eventType.trim(),
        label: label.trim(),
        detail: tags.trim(),
        sourcePath,
        memoryId: memoryId.trim(),
      });
    }
  }
  return rows.sort((left, right) => right.occurredAt - left.occurredAt).slice(0, 80);
}

export function buildTeamTimelineRows(params: {
  convexTimeline: TeamTimelineRow[] | undefined;
  memoryRows?: TeamMemoryRow[];
  communicationRows: CommunicationRow[];
  fileRows?: TeamTimelineRow[];
  projectId: string | undefined;
}): TeamTimelineRow[] {
  const memoryTimelineRows = buildMemoryTimelineRows(params.memoryRows ?? [], params.projectId);
  const convexRows = Array.isArray(params.convexTimeline) ? params.convexTimeline : [];
  const fileRows = Array.isArray(params.fileRows) ? params.fileRows : [];
  const communicationRows: TeamTimelineRow[] = params.communicationRows.map((row) => ({
    _id: row.id,
    sourceType: "agent_event",
    occurredAt: row.occurredAt,
    projectId: params.projectId ?? "project",
    agentId: row.agentId,
    activityType: row.activityType,
    label: row.label,
    detail: row.detail,
    taskId: row.taskId,
  }));
  return [...convexRows, ...fileRows, ...memoryTimelineRows, ...communicationRows]
    .sort((left, right) => right.occurredAt - left.occurredAt)
    .slice(0, 120);
}
