"use client";

/**
 * TIMELINE TAB
 * ============
 * Project decision and activity timeline backed by memory docs or live activity rows.
 *
 * KEY CONCEPTS:
 * - Project memory/history rows are the preferred event spine.
 * - Live AgentActivityFeed remains available when no memory events are present.
 * - Communication rows are the final fallback.
 *
 * USAGE:
 * - Rendered inside TeamPanel as the "timeline" TabsContent.
 */

import { useQuery } from "convex/react";
import { CalendarDays, CircleDot, FileText, Settings2, X } from "lucide-react";
import { type ReactElement, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { isConvexEnabled } from "@/providers/convex-provider";
import { api } from "../../../../../convex/_generated/api";
import type { CommunicationRow, TeamMemoryRow } from "./team-panel-types";
import { buildTeamTimelineRows, type TeamTimelineRow } from "./team-timeline";

interface TimelineTabProps {
  convexEnabled: boolean;
  projectId: string | null;
  projectPath?: string | null;
  teamScopeId: string | null;
  memoryRows: TeamMemoryRow[];
  communicationRows: CommunicationRow[];
  onOpenMineRun?: (target: { outputId?: string; projectPath?: string; runId: string }) => void;
  onConfigureHooks: () => void;
}

export function TimelineTab({
  convexEnabled,
  projectId,
  projectPath,
  teamScopeId,
  memoryRows,
  communicationRows,
  onOpenMineRun,
  onConfigureHooks,
}: TimelineTabProps): ReactElement {
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const timelineProjectId = useMemo(
    () => (projectPath?.trim() ? codexProjectIdFromPath(projectPath) : (projectId ?? teamScopeId)),
    [projectId, projectPath, teamScopeId],
  );
  const hookTimeline = useQuery(
    api.modules.hookTelemetry.queries.getLearningTimelineFromHookTelemetry,
    convexEnabled && isConvexEnabled() && timelineProjectId
      ? { projectId: timelineProjectId, rangeDays: 14, limit: 80 }
      : "skip",
  ) as LearningTimelineResponse | undefined;
  const hookRows = useMemo(
    () => (hookTimeline?.rows ?? []).map((row) => learningRowToTeamTimelineRow(row, timelineProjectId ?? "project")),
    [hookTimeline?.rows, timelineProjectId],
  );
  const timelineRows = buildTeamTimelineRows({
    convexTimeline: hookRows,
    memoryRows,
    communicationRows,
    projectId: teamScopeId ?? undefined,
  });
  const selectedRow = timelineRows.find((row) => row._id === selectedRowId) ?? null;
  const groupedClusters = useMemo(() => groupTimelineClusters(timelineRows), [timelineRows]);
  const sourceLabel = hookRows.length
    ? "Hook timeline"
    : timelineRows.some((row) => row.sourceType === "memory_event")
      ? "Memory history"
      : convexEnabled && teamScopeId
        ? "Live activity"
        : "Communications";

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <CardTitle className="text-sm">Project Timeline</CardTitle>
              {teamScopeId ? (
                <Badge variant="outline" className="text-[10px] uppercase">
                  {teamScopeId}
                </Badge>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {sourceLabel} · {timelineRows.length} event{timelineRows.length === 1 ? "" : "s"}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={onConfigureHooks}>
            <Settings2 className="size-4" />
            Configure Hooks
          </Button>
        </div>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 overflow-hidden">
        <div
          className={`grid h-full min-h-0 gap-3 ${
            selectedRow ? "grid-cols-[minmax(0,1fr)_360px]" : "grid-cols-1"
          }`}
        >
          <ScrollArea className="h-full min-h-0 rounded-md border bg-background">
            {timelineRows.length > 0 ? (
              <div className="px-5 py-4">
                {groupedClusters.map((group) => (
                  <section key={group.label} className="pb-5 last:pb-0">
                    <div className="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <CalendarDays className="size-3.5" />
                      <span>{group.label}</span>
                    </div>
                    <div className="relative space-y-1 pl-4">
                      <div className="absolute top-2 bottom-2 left-[7px] w-px bg-border" />
                      {group.clusters.map((cluster) => (
                        <TimelineEventCluster
                          key={cluster.id}
                          cluster={cluster}
                          selectedRowId={selectedRow?._id}
                          onSelect={setSelectedRowId}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <EmptyTimelineState
                convexEnabled={convexEnabled}
                onConfigureHooks={onConfigureHooks}
              />
            )}
          </ScrollArea>
          {selectedRow ? (
            <TimelineDetailPanel
              row={selectedRow}
              onClose={() => setSelectedRowId(null)}
              onOpenMineRun={onOpenMineRun}
            />
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function TimelineEventCluster({
  cluster,
  onSelect,
  selectedRowId,
}: {
  cluster: TimelineCluster;
  onSelect: (rowId: string) => void;
  selectedRowId?: string;
}): ReactElement {
  return (
    <div className="relative">
      <TimelineEventButton
        row={cluster.latest}
        selected={cluster.latest._id === selectedRowId}
        onSelect={() => onSelect(cluster.latest._id)}
      />
      {cluster.previous.length ? (
        <div className="ml-[30px] border-l border-dashed border-border/80 pl-3">
          {cluster.previous.map((row) => (
            <TimelineEventButton
              key={row._id}
              compact
              row={row}
              selected={row._id === selectedRowId}
              onSelect={() => onSelect(row._id)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TimelineEventButton({
  compact = false,
  onSelect,
  row,
  selected,
}: {
  compact?: boolean;
  onSelect: () => void;
  row: TeamTimelineRow;
  selected: boolean;
}): ReactElement {
  const typeLabel = compactEventType(row.eventType ?? row.activityType ?? row.sourceType);

  return (
    <button
      type="button"
      className={`relative grid w-full grid-cols-[18px_minmax(0,1fr)] gap-3 rounded-md px-2 py-3 text-left transition-colors ${
        selected ? "bg-primary/10" : "hover:bg-muted/50"
      } ${compact ? "py-2 opacity-90" : ""}`}
      onClick={onSelect}
    >
      <span
        className={`relative z-10 mt-1 flex items-center justify-center rounded-full border bg-background ${
          compact ? "size-3" : "size-3.5"
        }`}
      >
        <CircleDot className={`${compact ? "size-2.5" : "size-3"} ${selected ? "text-primary" : "text-muted-foreground"}`} />
      </span>
      <span className="min-w-0">
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          <Badge
            variant={row.sourceType === "memory_event" ? "secondary" : "outline"}
            className="max-w-[210px] truncate text-[10px] uppercase"
          >
            {typeLabel}
          </Badge>
          {row.memoryId ? (
            <Badge variant="outline" className="text-[10px] uppercase">
              {row.memoryId}
            </Badge>
          ) : null}
          {row.taskId ? (
            <Badge variant="outline" className="text-[10px] uppercase">
              {row.taskId}
            </Badge>
          ) : null}
          <span className="text-xs text-muted-foreground">{formatTime(row.occurredAt)}</span>
        </span>
        <span
          className={`mt-1 line-clamp-1 block break-words font-medium leading-5 [overflow-wrap:anywhere] ${
            compact ? "text-xs" : "text-sm"
          }`}
        >
          {row.label}
        </span>
        {row.detail ? (
          <span className="mt-1 line-clamp-2 block break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
            {row.detail}
          </span>
        ) : null}
      </span>
    </button>
  );
}

function TimelineDetailPanel({
  onClose,
  row,
  onOpenMineRun,
}: {
  onClose: () => void;
  onOpenMineRun?: (target: { outputId?: string; projectPath?: string; runId: string }) => void;
  row: TeamTimelineRow;
}): ReactElement {
  const eventMinerRunId = eventMinerRunIdFromReviewPath(row.reviewRunPath);
  const [eventMinerReport, setEventMinerReport] = useState<EventMinerReportState>({
    runId: null,
    status: "idle",
  });

  useEffect(() => {
    if (!eventMinerRunId) {
      setEventMinerReport({ runId: null, status: "idle" });
      return;
    }
    let active = true;
    setEventMinerReport({ runId: eventMinerRunId, status: "loading" });
    fetch(eventMinerReportUrl(eventMinerRunId, row.projectPath))
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as EventMinerReportResponse | null;
        if (!response.ok || !payload?.ok || !payload.detail) {
          throw new Error(payload?.error ?? "event_miner_report_not_found");
        }
        return payload.detail;
      })
      .then((detail) => {
        if (active) setEventMinerReport({ detail, runId: eventMinerRunId, status: "loaded" });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setEventMinerReport({
          error: error instanceof Error ? error.message : "event_miner_report_not_found",
          runId: eventMinerRunId,
          status: "error",
        });
      });
    return () => {
      active = false;
    };
  }, [eventMinerRunId]);

  return (
    <aside className="h-full min-h-0 overflow-hidden rounded-md border bg-background">
      <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <h3 className="line-clamp-2 font-medium text-sm">{row.label}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {row.eventType ?? row.activityType ?? row.sourceType} · {formatDateTime(row.occurredAt)}
          </p>
        </div>
        <Button size="icon" variant="ghost" aria-label="Close timeline detail" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>
      <ScrollArea className="h-[calc(100%-57px)]">
        <div className="space-y-4 p-4">
          <DetailBlock label="Summary" value={row.label} />
          {row.detail ? <DetailBlock label="Detail" value={row.detail} /> : null}
          <div className="grid grid-cols-2 gap-3">
            <DetailBlock label="Source" value={row.sourceType} />
            <DetailBlock label="Project" value={row.projectId} />
            {row.memoryId ? <DetailBlock label="Memory" value={row.memoryId} /> : null}
            {row.taskId ? <DetailBlock label="Task" value={row.taskId} /> : null}
            {row.agentId ? <DetailBlock label="Agent" value={row.agentId} /> : null}
            {row.sessionId ? <DetailBlock label="Session" value={row.sessionId} /> : null}
            {row.sourceProgram ? <DetailBlock label="Program" value={row.sourceProgram} /> : null}
            {row.runId ? <DetailBlock label="Run" value={row.runId} /> : null}
            {row.outputId ? <DetailBlock label="Output" value={row.outputId} /> : null}
          </div>
          {row.reviewRunPath ? (
            <DetailBlock label="Review Run" value={row.reviewRunPath} mono />
          ) : null}
          {row.runId ? (
            <Button
              className="w-full justify-start"
              size="sm"
              variant="outline"
              onClick={() =>
                onOpenMineRun?.({
                  outputId: row.outputId,
                  projectPath: row.projectPath,
                  runId: row.runId ?? "",
                })
              }
            >
              <FileText className="size-4" />
              Open Mine Run
            </Button>
          ) : null}
          {eventMinerRunId ? <EventMinerReportPreview state={eventMinerReport} /> : null}
          {row.changedFields?.length ? (
            <DetailBlock label="Changed Fields" value={row.changedFields.join(", ")} mono />
          ) : null}
          {row.sourcePath ? (
            <div className="rounded-md border bg-muted/30 p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <FileText className="size-3.5" />
                Source Path
              </div>
              <p className="break-words font-mono text-xs [overflow-wrap:anywhere]">
                {row.sourcePath}
              </p>
            </div>
          ) : null}
        </div>
      </ScrollArea>
    </aside>
  );
}

function DetailBlock({
  label,
  mono = false,
  value,
}: {
  label: string;
  mono?: boolean;
  value: string;
}): ReactElement {
  return (
    <div className="rounded-md border bg-background p-3">
      <div className="text-[11px] font-medium uppercase text-muted-foreground">{label}</div>
      <p className={`mt-1 break-words text-sm [overflow-wrap:anywhere] ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function EventMinerReportPreview({ state }: { state: EventMinerReportState }): ReactElement {
  if (state.status === "loading") {
    return <DetailBlock label="Miner Report" value="Loading report..." />;
  }
  if (state.status === "error") {
    return <DetailBlock label="Miner Report" value={state.error ?? "Report unavailable"} />;
  }
  if (state.status !== "loaded") {
    return <DetailBlock label="Miner Report" value="Report unavailable" />;
  }
  const report = normalizeEventMinerReport(state.detail?.report);
  if (!report) return <DetailBlock label="Miner Report" value="Report unavailable" />;
  const events = report.events.slice(0, 5);
  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-[11px] font-medium uppercase text-muted-foreground">Miner Report</div>
        <Badge variant="outline" className="text-[10px] uppercase">
          {report.status}
        </Badge>
      </div>
      <p className="break-words text-sm [overflow-wrap:anywhere]">{report.summary}</p>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <ReportMetric label="Observed" value={String(report.observed ?? events.length)} />
        {report.ticketId ? <ReportMetric label="Ticket" value={report.ticketId} /> : null}
      </div>
      {events.length ? (
        <div className="mt-3 space-y-2">
          {events.map((event, index) => (
            <div key={`${event.eventName}:${index}`} className="rounded border bg-background p-2">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="text-[10px] uppercase">
                  {compactEventType(event.eventName)}
                </Badge>
                {event.severity ? (
                  <span className="text-[11px] text-muted-foreground">{event.severity}</span>
                ) : null}
              </div>
              <p className="line-clamp-3 break-words text-xs [overflow-wrap:anywhere]">{event.summary}</p>
            </div>
          ))}
        </div>
      ) : null}
      {state.detail?.reportPath ? (
        <p className="mt-3 break-words font-mono text-[11px] text-muted-foreground [overflow-wrap:anywhere]">
          {state.detail.reportPath}
        </p>
      ) : null}
    </div>
  );
}

function ReportMetric({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div className="rounded border bg-background px-2 py-1.5">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="truncate font-mono text-[11px]">{value}</div>
    </div>
  );
}

function EmptyTimelineState({
  convexEnabled,
  onConfigureHooks,
}: {
  convexEnabled: boolean;
  onConfigureHooks: () => void;
}): ReactElement {
  return (
    <div className="flex h-full min-h-[280px] items-center justify-center p-8">
      <div className="max-w-[420px] text-center">
        <div className="mx-auto flex size-10 items-center justify-center rounded-full border bg-muted/30">
          <CircleDot className="size-5 text-muted-foreground" />
        </div>
        <h3 className="mt-4 font-medium text-sm">No project events yet</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {convexEnabled
            ? "Configure project hooks to start capturing ticket, progress, and harness events."
            : "Convex is unavailable, but local hook configuration can still be reviewed."}
        </p>
        <Button className="mt-4" size="sm" onClick={onConfigureHooks}>
          <Settings2 className="size-4" />
          Configure Hooks
        </Button>
      </div>
    </div>
  );
}

type TimelineCluster = {
  id: string;
  latest: TeamTimelineRow;
  previous: TeamTimelineRow[];
};

type TimelineGroup = {
  label: string;
  clusters: TimelineCluster[];
};

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

function groupTimelineClusters(rows: TeamTimelineRow[]): TimelineGroup[] {
  const groups = new Map<string, TimelineCluster[]>();
  for (const cluster of clusterTimelineRows(rows)) {
    const label = formatDay(cluster.latest.occurredAt);
    groups.set(label, [...(groups.get(label) ?? []), cluster]);
  }
  return [...groups.entries()].map(([label, clusters]) => ({ label, clusters }));
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

function formatTime(value: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDateTime(value: number): string {
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function codexProjectIdFromPath(projectPath: string): string {
  const slug = projectPath
    .trim()
    .replace(/\/+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `codex-proj-${slug || "codex"}`;
}

type LearningTimelineResponse = {
  rows: LearningTimelineRow[];
};

type LearningTimelineRow = {
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

type EventMinerReportResponse = {
  ok: boolean;
  detail?: EventMinerReportDetail | null;
  error?: string;
};

type EventMinerReportDetail = {
  runId: string;
  reportPath?: string;
  report?: unknown;
};

type EventMinerReportState =
  | { runId: string | null; status: "idle" | "loading" }
  | { runId: string; status: "loaded"; detail: EventMinerReportDetail }
  | { runId: string; status: "error"; error: string };

type EventMinerReport = {
  status: string;
  observed?: number;
  summary: string;
  ticketId?: string;
  events: EventMinerReportEvent[];
};

type EventMinerReportEvent = {
  eventName: string;
  summary: string;
  severity?: string;
};

function learningRowToTeamTimelineRow(row: LearningTimelineRow, fallbackProjectId: string): TeamTimelineRow {
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

function compactEventType(value: string): string {
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

function eventMinerRunIdFromReviewPath(value: string | undefined): string | undefined {
  return value?.match(/\.farplane\/event-miner\/runs\/([^/]+)/)?.[1];
}

function eventMinerReportUrl(runId: string, projectPath: string | undefined): string {
  const params = new URLSearchParams();
  if (projectPath) params.set("projectPath", projectPath);
  const suffix = params.toString();
  return `/farplane/event-miner/runs/${encodeURIComponent(runId)}${suffix ? `?${suffix}` : ""}`;
}

function normalizeEventMinerReport(value: unknown): EventMinerReport | null {
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
