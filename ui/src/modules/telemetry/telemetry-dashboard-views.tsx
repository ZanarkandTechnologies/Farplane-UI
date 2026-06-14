"use client";

/**
 * TELEMETRY DASHBOARD VIEWS
 * =========================
 * Ownership: Telemetry module.
 * Inputs: reduced runtime telemetry summaries and paged turn rows.
 * Outputs: Recharts-backed dashboard, summary tables, raw telemetry inspection UI.
 * Side effects: none.
 * Invariants: views render derived metadata only; no raw transcripts are shown.
 */

import {
  Activity as ActivityIcon,
  AlertTriangle as AlertTriangleIcon,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Clock,
  Database,
  GitBranch,
  Network,
  Timer,
} from "lucide-react";
import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatCompletionSource,
  formatDeltaHours,
  formatDuration,
  formatHours,
  formatRelativeTime,
} from "./telemetry-dashboard-format";
import type {
  RawSourceFilter,
  RawStatusFilter,
  RuntimeTurn,
  TelemetryBreakdown,
  TelemetrySummary,
} from "./telemetry-dashboard-types";

type TelemetryMetricGridProps = {
  data: TelemetrySummary;
};

type BreakdownTableProps = {
  rows: TelemetryBreakdown[];
  emptyLabel: string;
};

type RawTelemetryTableProps = {
  rows: RuntimeTurn[];
  page: number;
  pageCount: number;
  total: number;
  statusFilter: RawStatusFilter;
  sourceFilter: RawSourceFilter;
  onPageChange: (page: number) => void;
  onStatusFilterChange: (value: RawStatusFilter) => void;
  onSourceFilterChange: (value: RawSourceFilter) => void;
};

export { TelemetryDashboardView } from "./telemetry-dashboard-recharts";

const STATUS_FILTERS: Array<{ label: string; value: RawStatusFilter }> = [
  { label: "All status", value: "all" },
  { label: "Completed", value: "completed" },
  { label: "Filtered", value: "filtered" },
  { label: "Open", value: "in_progress" },
  { label: "Unmatched", value: "unmatched" },
];

const SOURCE_FILTERS: Array<{ label: string; value: RawSourceFilter }> = [
  { label: "All sources", value: "all" },
  { label: "Stop hook", value: "explicit_end" },
  { label: "Next start", value: "next_start_recovery" },
  { label: "Over cap", value: "duration_cap" },
  { label: "Diagnostic", value: "diagnostic" },
];

export function TelemetryMetricGrid({ data }: TelemetryMetricGridProps): ReactElement {
  const latest = data.dailyBuckets[data.dailyBuckets.length - 1];
  const dailyCapacityHours = (latest?.projectCount ?? 0) * 24;
  const dailyCapacityPercent = dailyCapacityHours > 0 ? Math.round((data.agentHourSummary.todayHours / dailyCapacityHours) * 100) : 0;
  const metrics = [
    {
      icon: Clock,
      label: "Today",
      value: formatHours(data.agentHourSummary.todayHours),
      detail: `${formatDeltaHours(data.agentHourSummary.deltaHours)} vs yesterday`,
    },
    {
      icon: ActivityIcon,
      label: "30d total",
      value: formatHours(data.agentHourSummary.trailingAgentHours),
      detail: `${formatHours(data.agentHourSummary.averageDailyHours)} avg/day`,
    },
    {
      icon: BarChart3,
      label: "Capacity",
      value: `${dailyCapacityPercent}%`,
      detail: `${latest?.projectCount ?? 0} projects x 24h`,
    },
    {
      icon: Network,
      label: "Peak parallel",
      value: `${data.parallelCapacity.today.peakConcurrentSessions}S / ${data.parallelCapacity.today.peakConcurrentProjects}P`,
      detail: "sessions / projects today",
    },
    {
      icon: GitBranch,
      label: "Today breadth",
      value: `${latest?.projectCount ?? 0}P`,
      detail: `${data.stats.projectCount} tracked total`,
    },
    {
      icon: ActivityIcon,
      label: "Availability",
      value: `${latest?.availabilityPercent ?? 0}%`,
      detail: latest ? `${latest.coveredHours}/24 ping hours` : "no hook coverage",
    },
    {
      icon: Timer,
      label: "Longest",
      value: latest?.longestTurnDurationMs === null || latest === undefined ? "Waiting" : formatDuration(latest.longestTurnDurationMs),
      detail: latest?.longestTurnProjectDisplayName ?? "daily max",
    },
    {
      icon: AlertTriangleIcon,
      label: "Filtered",
      value: String(data.stats.filteredTurnCount),
      detail: `${formatHours(data.stats.filteredAgentHours)} excluded`,
    },
    {
      icon: Database,
      label: "Pings",
      value: String(data.stats.totalPings),
      detail: data.stats.lastSeenAt ? `last ${formatRelativeTime(data.stats.lastSeenAt)}` : "no rows",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
      {metrics.map((metric) => (
        <Card key={metric.label} className="gap-2 rounded-md py-3">
          <CardHeader className="px-3 pb-0">
            <CardTitle className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-normal text-muted-foreground">
              <metric.icon className="size-3.5" />
              {metric.label}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3">
            <div className="truncate text-xl font-semibold tabular-nums">{metric.value}</div>
            <div className="mt-1 truncate text-[11px] text-muted-foreground">{metric.detail}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function BreakdownTable({ rows, emptyLabel }: BreakdownTableProps): ReactElement {
  if (rows.length === 0) {
    return <TelemetryStateCard title={emptyLabel} detail="Lifecycle rows will appear here after hooks report activity." />;
  }

  return (
    <ScrollArea className="h-full pr-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="text-right">Hours</TableHead>
            <TableHead className="text-right">Turns</TableHead>
            <TableHead className="text-right">Open</TableHead>
            <TableHead className="text-right">Unmatched</TableHead>
            <TableHead>Last seen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.key}>
              <TableCell className="max-w-[240px] truncate font-medium">{row.displayName}</TableCell>
              <TableCell className="text-right tabular-nums">{formatHours(row.agentHours)}</TableCell>
              <TableCell className="text-right tabular-nums">{row.completedTurnCount}</TableCell>
              <TableCell className="text-right tabular-nums">{row.inProgressTurnCount}</TableCell>
              <TableCell className="text-right tabular-nums">{row.unmatchedTurnCount}</TableCell>
              <TableCell>{row.lastSeenAt ? formatRelativeTime(row.lastSeenAt) : "never"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}

export function RawTelemetryTable({
  rows,
  page,
  pageCount,
  total,
  statusFilter,
  sourceFilter,
  onPageChange,
  onStatusFilterChange,
  onSourceFilterChange,
}: RawTelemetryTableProps): ReactElement {
  const visibleRows = rows.filter(
    (turn) => matchesStatus(turn, statusFilter) && matchesSource(turn, sourceFilter),
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={statusFilter} onValueChange={(value) => onStatusFilterChange(value as RawStatusFilter)}>
            <SelectTrigger size="sm" className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sourceFilter} onValueChange={(value) => onSourceFilterChange(value as RawSourceFilter)}>
            <SelectTrigger size="sm" className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SOURCE_FILTERS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            Page {page} of {pageCount} / {total} turns
          </span>
          <Button aria-label="Previous raw telemetry page" disabled={page <= 1} onClick={() => onPageChange(Math.max(1, page - 1))} size="icon" variant="outline">
            <ChevronLeft className="size-4" />
          </Button>
          <Button aria-label="Next raw telemetry page" disabled={page >= pageCount} onClick={() => onPageChange(Math.min(pageCount, page + 1))} size="icon" variant="outline">
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
      {visibleRows.length === 0 ? (
        <TelemetryStateCard title="No raw rows match" detail="Adjust the status or source filters for this page." />
      ) : (
        <ScrollArea className="min-h-0 flex-1 pr-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Turn</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Duration</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Ended</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRows.map((turn) => (
                <TableRow key={turn.id}>
                  <TableCell className="max-w-[180px] truncate font-mono text-xs">{turn.turnId}</TableCell>
                  <TableCell className="max-w-[220px] truncate">{turn.projectName ?? turn.projectId ?? "Unlabeled"}</TableCell>
                  <TableCell>
                    <Badge variant={turn.status === "completed" ? "outline" : "secondary"}>{turn.status.replace("_", " ")}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{turn.durationMs === null ? "open" : formatDuration(turn.durationMs)}</TableCell>
                  <TableCell className="max-w-[150px] truncate text-xs text-muted-foreground">{formatCompletionSource(turn)}</TableCell>
                  <TableCell>{turn.agentName ?? "unknown"}</TableCell>
                  <TableCell>{turn.endedAt ? formatRelativeTime(turn.endedAt) : "not ended"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      )}
    </div>
  );
}

export function TelemetryStateCard({ detail, title }: { detail: string; title: string }): ReactElement {
  return (
    <Card className="rounded-md">
      <CardContent className="py-8">
        <p className="font-medium">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function matchesStatus(turn: RuntimeTurn, filter: RawStatusFilter): boolean {
  return filter === "all" || turn.status === filter;
}

function matchesSource(turn: RuntimeTurn, filter: RawSourceFilter): boolean {
  if (filter === "all") return true;
  if (filter === "duration_cap") return turn.filteredReason === "duration_cap";
  if (filter === "diagnostic") return turn.completionSource === null;
  return turn.completionSource === filter;
}
