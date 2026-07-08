"use client";

/**
 * Timeline tab presentational components.
 * Renders grouped events, loading/empty states, and selected event details.
 */

import { CalendarDays, CircleDot, FileText, Loader2, Settings2, X } from "lucide-react";
import { type ReactElement, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { TeamTimelineRow } from "./team-timeline";
import {
  compactEventType,
  type EventMinerReportResponse,
  type EventMinerReportState,
  eventMinerReportUrl,
  eventMinerRunIdFromReviewPath,
  formatDateTime,
  formatTime,
  normalizeEventMinerReport,
  type TimelineCluster,
  type TimelineGroup,
} from "./timeline-model";

export function TimelineEventsList({
  groups,
  onSelect,
  selectedRowId,
}: {
  groups: TimelineGroup[];
  onSelect: (rowId: string) => void;
  selectedRowId?: string;
}): ReactElement {
  return (
    <div className="px-5 py-4">
      {groups.map((group) => (
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
                selectedRowId={selectedRowId}
                onSelect={onSelect}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function TimelineLoadingState(): ReactElement {
  return (
    <div className="flex h-full min-h-[280px] items-center justify-center p-8">
      <div className="max-w-[420px] text-center text-sm text-muted-foreground">
        <div className="mx-auto flex size-10 items-center justify-center rounded-full border bg-muted/30">
          <Loader2 className="size-5 animate-spin" />
        </div>
        <h3 className="mt-4 font-medium text-sm text-foreground">Loading project timeline</h3>
        <p className="mt-2">Waiting for hook telemetry before showing local history.</p>
      </div>
    </div>
  );
}

export function TimelineDetailPanel({
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
        const payload = (await response
          .json()
          .catch(() => null)) as EventMinerReportResponse | null;
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
  }, [eventMinerRunId, row.projectPath]);

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

export function EmptyTimelineState({
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
        <CircleDot
          className={`${compact ? "size-2.5" : "size-3"} ${selected ? "text-primary" : "text-muted-foreground"}`}
        />
      </span>
      <span className="min-w-0">
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          <Badge
            variant={
              row.sourceType === "memory_event" || row.sourceType === "report_event"
                ? "secondary"
                : "outline"
            }
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
      <p
        className={`mt-1 break-words text-sm [overflow-wrap:anywhere] ${mono ? "font-mono text-xs" : ""}`}
      >
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
          {events.map((event) => (
            <div
              key={`${event.eventName}:${event.summary}`}
              className="rounded border bg-background p-2"
            >
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="text-[10px] uppercase">
                  {compactEventType(event.eventName)}
                </Badge>
                {event.severity ? (
                  <span className="text-[11px] text-muted-foreground">{event.severity}</span>
                ) : null}
              </div>
              <p className="line-clamp-3 break-words text-xs [overflow-wrap:anywhere]">
                {event.summary}
              </p>
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
