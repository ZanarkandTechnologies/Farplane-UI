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

import { CalendarDays, CircleDot, FileText, Settings2, X } from "lucide-react";
import { type ReactElement, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { CommunicationRow, TeamMemoryRow } from "./team-panel-types";
import { buildTeamTimelineRows, type TeamTimelineRow } from "./team-timeline";

interface TimelineTabProps {
  convexEnabled: boolean;
  teamScopeId: string | null;
  memoryRows: TeamMemoryRow[];
  communicationRows: CommunicationRow[];
  onConfigureHooks: () => void;
}

export function TimelineTab({
  convexEnabled,
  teamScopeId,
  memoryRows,
  communicationRows,
  onConfigureHooks,
}: TimelineTabProps): ReactElement {
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const timelineRows = buildTeamTimelineRows({
    convexTimeline: undefined,
    memoryRows,
    communicationRows,
    projectId: teamScopeId ?? undefined,
  });
  const selectedRow = timelineRows.find((row) => row._id === selectedRowId) ?? null;
  const groupedRows = useMemo(() => groupTimelineRows(timelineRows), [timelineRows]);
  const sourceLabel = timelineRows.some((row) => row.sourceType === "memory_event")
    ? "Memory history"
    : convexEnabled && teamScopeId
      ? "Live activity"
      : "Communications";

  return (
    <Card className="h-full overflow-hidden">
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
      <CardContent className="h-[calc(100%-3rem)] overflow-hidden">
        <div
          className={`grid h-full min-h-0 gap-3 ${
            selectedRow ? "grid-cols-[minmax(0,1fr)_360px]" : "grid-cols-1"
          }`}
        >
          <ScrollArea className="h-full rounded-md border bg-background">
            {timelineRows.length > 0 ? (
              <div className="px-5 py-4">
                {groupedRows.map((group) => (
                  <section key={group.label} className="pb-5 last:pb-0">
                    <div className="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <CalendarDays className="size-3.5" />
                      <span>{group.label}</span>
                    </div>
                    <div className="relative space-y-1 pl-4">
                      <div className="absolute top-2 bottom-2 left-[7px] w-px bg-border" />
                      {group.rows.map((row) => (
                        <TimelineEventButton
                          key={row._id}
                          row={row}
                          selected={row._id === selectedRow?._id}
                          onSelect={() => setSelectedRowId(row._id)}
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
            <TimelineDetailPanel row={selectedRow} onClose={() => setSelectedRowId(null)} />
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function TimelineEventButton({
  onSelect,
  row,
  selected,
}: {
  onSelect: () => void;
  row: TeamTimelineRow;
  selected: boolean;
}): ReactElement {
  const typeLabel = row.eventType ?? row.activityType ?? row.sourceType;

  return (
    <button
      type="button"
      className={`relative grid w-full grid-cols-[18px_minmax(0,1fr)] gap-3 rounded-md px-2 py-3 text-left transition-colors ${
        selected ? "bg-primary/10" : "hover:bg-muted/50"
      }`}
      onClick={onSelect}
    >
      <span className="relative z-10 mt-1 flex size-3.5 items-center justify-center rounded-full border bg-background">
        <CircleDot className={`size-3 ${selected ? "text-primary" : "text-muted-foreground"}`} />
      </span>
      <span className="min-w-0">
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          <Badge
            variant={row.sourceType === "memory_event" ? "secondary" : "outline"}
            className="text-[10px] uppercase"
          >
            {typeLabel}
          </Badge>
          {row.memoryId ? (
            <Badge variant="outline" className="text-[10px] uppercase">
              {row.memoryId}
            </Badge>
          ) : null}
          <span className="text-xs text-muted-foreground">{formatTime(row.occurredAt)}</span>
        </span>
        <span className="mt-1 block break-words font-medium text-sm leading-5 [overflow-wrap:anywhere]">
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
}: {
  onClose: () => void;
  row: TeamTimelineRow;
}): ReactElement {
  return (
    <aside className="min-h-0 overflow-hidden rounded-md border bg-background">
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
          </div>
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

function DetailBlock({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div className="rounded-md border bg-background p-3">
      <div className="text-[11px] font-medium uppercase text-muted-foreground">{label}</div>
      <p className="mt-1 break-words text-sm [overflow-wrap:anywhere]">{value}</p>
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

type TimelineGroup = {
  label: string;
  rows: TeamTimelineRow[];
};

function groupTimelineRows(rows: TeamTimelineRow[]): TimelineGroup[] {
  const groups = new Map<string, TeamTimelineRow[]>();
  for (const row of rows) {
    const label = formatDay(row.occurredAt);
    groups.set(label, [...(groups.get(label) ?? []), row]);
  }
  return [...groups.entries()].map(([label, groupRows]) => ({ label, rows: groupRows }));
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
