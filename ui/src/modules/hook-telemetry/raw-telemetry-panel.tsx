"use client";

/**
 * RAW HOOK TELEMETRY PANEL
 * ========================
 * Ownership: hook-telemetry UI module.
 * Inputs: Convex hookTelemetry explorer query plus local hook setup defaults.
 * Outputs: compact event log, distribution summary, and hook installation guidance.
 * Side effects: optional clipboard copy only.
 */

import { useQuery } from "convex/react";
import { Search } from "lucide-react";
import { type ReactElement, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UI_Z } from "@/lib/z-index";
import { isConvexEnabled } from "@/providers/convex-provider";
import { useOfficeAccessMode } from "@/providers/office-access-mode-provider";
import { api } from "../../../../convex/_generated/api";
import { EventProgramsPanel } from "./event-programs-panel";
import { TimelineHooksPanel } from "./timeline-hook-panels";

type RawTelemetryPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export type HookTelemetryEvent = {
  _id?: string;
  hookName: string;
  hookType: string;
  eventName?: string;
  projectId?: string;
  sessionId?: string;
  payload?: unknown;
  eventAt: number;
  eventKey?: string;
};

type DistributionRow = {
  key: string;
  count: number;
};

type DistributionViewId = keyof HookTelemetryExplorer["distributions"];

type HookTelemetryExplorer = {
  events: HookTelemetryEvent[];
  total: number;
  distributions: {
    hookNames: DistributionRow[];
    hookTypes: DistributionRow[];
    eventNames: DistributionRow[];
    sessions: DistributionRow[];
  };
};

const RANGE_OPTIONS = [
  { label: "1 day", value: 1 },
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
] as const;

const EVENT_FILTERS = [
  "all",
  "skill.invoked",
  "file.change.summary",
  "thread.started",
  "thread.stopped",
  "thread.created",
  "thread.forked",
  "thread.spawned",
  "farplane.ticket.changed",
  "farplane.ticket.completed",
  "farplane.ticket.progress.changed",
] as const;

export function RawTelemetryPanel({ open, onOpenChange }: RawTelemetryPanelProps): ReactElement {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[88vh] min-w-[86vw] max-w-none flex-col overflow-hidden p-0"
        style={{ zIndex: UI_Z.panelElevated }}
      >
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Project Timeline</DialogTitle>
        </DialogHeader>
        <RawTelemetryContent />
      </DialogContent>
    </Dialog>
  );
}

export function RawTelemetryRoute(): ReactElement {
  return (
    <main className="flex h-[100dvh] w-[100dvw] flex-col overflow-hidden bg-background text-foreground">
      <div className="border-b px-6 py-4">
        <h1 className="text-lg font-semibold">Project Timeline</h1>
      </div>
      <RawTelemetryContent />
    </main>
  );
}

export function RawTelemetryContent(): ReactElement {
  const { isReadOnly } = useOfficeAccessMode();
  const convexEnabled = isConvexEnabled();
  const [rangeDays, setRangeDays] = useState(7);
  const [hookName, setHookName] = useState("");
  const [hookType, setHookType] = useState("");
  const [eventName, setEventName] = useState<(typeof EVENT_FILTERS)[number]>("all");
  const queryArgs = useMemo(
    () => ({
      rangeDays,
      limit: 500,
      hookName: hookName.trim() || undefined,
      hookType: hookType.trim() || undefined,
      eventName: eventName === "all" ? undefined : eventName,
    }),
    [eventName, hookName, hookType, rangeDays],
  );
  const data = useQuery(
    api.modules.hookTelemetry.queries.getHookTelemetryExplorer,
    convexEnabled && !isReadOnly ? queryArgs : "skip",
  ) as HookTelemetryExplorer | undefined;

  if (isReadOnly) {
    return (
      <div className="px-6 py-6">
        <StateCard
          title="Raw telemetry locked"
          detail="Raw hook events are only available in operator mode."
        />
      </div>
    );
  }

  return (
    <Tabs
      defaultValue={convexEnabled ? "events" : "programs"}
      className="flex min-h-0 flex-1 flex-col px-6 pb-6 pt-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabsList>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="hooks">Hooks</TabsTrigger>
          <TabsTrigger value="programs">Programs</TabsTrigger>
          <TabsTrigger value="raw">Raw</TabsTrigger>
          <TabsTrigger value="distribution">Distribution</TabsTrigger>
        </TabsList>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={String(rangeDays)} onValueChange={(value) => setRangeDays(Number(value))}>
            <SelectTrigger aria-label="Raw telemetry range" size="sm" className="w-[110px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={String(option.value)}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={eventName}
            onValueChange={(value) => setEventName(value as typeof eventName)}
          >
            <SelectTrigger aria-label="Event name filter" size="sm" className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EVENT_FILTERS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option === "all" ? "All events" : option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative">
            <Search className="-translate-y-1/2 absolute top-1/2 left-2 size-3.5 text-muted-foreground" />
            <Input
              aria-label="Hook name filter"
              className="h-8 w-[170px] pl-7"
              placeholder="hook name"
              value={hookName}
              onChange={(event) => setHookName(event.target.value)}
            />
          </div>
          <Input
            aria-label="Hook type filter"
            className="h-8 w-[140px]"
            placeholder="hook type"
            value={hookType}
            onChange={(event) => setHookType(event.target.value)}
          />
        </div>
      </div>

      <TabsContent value="events" className="mt-3 min-h-0 flex-1">
        {data ? (
          <EventTable rows={data.events} total={data.total} />
        ) : (
          <StateCard
            title={convexEnabled ? "Loading events" : "Event mirror unavailable"}
            detail={
              convexEnabled
                ? "Reading hook telemetry rows..."
                : "Convex is optional; Core programs, routes, runs, and reports remain available."
            }
          />
        )}
      </TabsContent>
      <TabsContent value="hooks" className="mt-3 min-h-0 flex-1">
        <TimelineHooksPanel events={data?.events ?? []} />
      </TabsContent>
      <TabsContent value="programs" className="mt-3 min-h-0 flex-1">
        <EventProgramsPanel events={data?.events ?? []} />
      </TabsContent>
      <TabsContent value="raw" className="mt-3 min-h-0 flex-1">
        {data ? (
          <EventTable rows={data.events} total={data.total} />
        ) : (
          <StateCard
            title={convexEnabled ? "Loading raw events" : "Event mirror unavailable"}
            detail={
              convexEnabled
                ? "Reading hook telemetry rows..."
                : "Convex is not configured for this UI session."
            }
          />
        )}
      </TabsContent>
      <TabsContent value="distribution" className="mt-3 min-h-0 flex-1">
        {data ? (
          <DistributionGrid data={data.distributions} total={data.total} />
        ) : (
          <StateCard
            title={convexEnabled ? "Loading distribution" : "Event mirror unavailable"}
            detail={
              convexEnabled
                ? "Aggregating hook telemetry rows..."
                : "Convex is not configured for this UI session."
            }
          />
        )}
      </TabsContent>
    </Tabs>
  );
}

function EventTable({ rows, total }: { rows: HookTelemetryEvent[]; total: number }): ReactElement {
  if (rows.length === 0) {
    return (
      <StateCard
        title="No hook events"
        detail="Install hooks or widen the filters to see raw event rows."
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="text-xs text-muted-foreground">
        {total} event{total === 1 ? "" : "s"} in the current window
      </div>
      <ScrollArea className="min-h-0 flex-1 pr-3">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Event</TableHead>
              <TableHead>Hook</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Session</TableHead>
              <TableHead>Payload</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row._id ?? row.eventKey ?? `${row.hookName}:${row.eventAt}`}>
                <TableCell className="whitespace-nowrap text-xs">
                  {formatDate(row.eventAt)}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{row.eventName ?? "unknown"}</Badge>
                </TableCell>
                <TableCell className="max-w-[180px] truncate font-mono text-xs">
                  {row.hookName}
                </TableCell>
                <TableCell className="max-w-[140px] truncate">{row.hookType}</TableCell>
                <TableCell className="max-w-[180px] truncate font-mono text-xs">
                  {row.sessionId ?? "none"}
                </TableCell>
                <TableCell className="max-w-[360px] truncate font-mono text-xs text-muted-foreground">
                  {payloadPreview(row.payload)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
}

function DistributionGrid({
  data,
  total,
}: {
  data: HookTelemetryExplorer["distributions"];
  total: number;
}): ReactElement {
  const [selectedView, setSelectedView] = useState<DistributionViewId>("hookNames");
  const views: Array<{ id: DistributionViewId; title: string }> = [
    { id: "hookNames", title: "Hook Names" },
    { id: "eventNames", title: "Event Names" },
    { id: "hookTypes", title: "Hook Types" },
    { id: "sessions", title: "Sessions" },
  ];
  const selected = views.find((view) => view.id === selectedView) ?? views[0];

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {views.map((view) => (
          <Button
            key={view.id}
            type="button"
            variant={view.id === selectedView ? "default" : "outline"}
            className="h-auto justify-between gap-3 px-3 py-2"
            onClick={() => setSelectedView(view.id)}
          >
            <span className="truncate">{view.title}</span>
            <span className="font-mono text-xs opacity-80">{data[view.id].length}</span>
          </Button>
        ))}
      </div>
      <DistributionCard title={selected.title} rows={data[selected.id]} total={total} />
    </div>
  );
}

function DistributionCard({
  rows,
  title,
  total,
}: {
  rows: DistributionRow[];
  title: string;
  total: number;
}): ReactElement {
  const chartRows = useMemo(
    () =>
      rows.slice(0, 12).map((row) => ({
        ...row,
        label: compactDistributionLabel(row.key),
        percent: total > 0 ? Math.round((row.count / total) * 100) : 0,
      })),
    [rows, total],
  );

  return (
    <Card className="flex min-h-0 flex-1 flex-col rounded-md">
      <CardHeader className="py-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-sm">{title}</CardTitle>
          <span className="font-mono text-xs text-muted-foreground">{rows.length} keys</span>
        </div>
      </CardHeader>
      <CardContent className="min-h-0 flex-1">
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">No rows.</p> : null}
        {chartRows.length > 0 ? (
          <div className="h-full min-h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartRows}
                layout="vertical"
                margin={{ top: 8, right: 52, bottom: 18, left: 8 }}
                barCategoryGap={10}
              >
                <CartesianGrid horizontal={false} stroke="#262b31" strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  domain={[0, "dataMax"]}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#8f9aad", fontSize: 11 }}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={220}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#c7ccd6", fontSize: 12 }}
                />
                <Tooltip
                  cursor={{ fill: "rgba(148, 163, 184, 0.08)" }}
                  content={<DistributionTooltip />}
                />
                <Bar
                  dataKey="count"
                  fill="#b97455"
                  radius={[0, 4, 4, 0]}
                  maxBarSize={24}
                  label={{
                    position: "right",
                    fill: "#9aa5b8",
                    fontSize: 12,
                    formatter: (value: unknown) => String(value),
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function compactDistributionLabel(value: string): string {
  const normalized = value.trim() || "unknown";
  if (normalized.length <= 28) return normalized;
  if (/^[0-9a-f-]{24,}$/i.test(normalized))
    return `${normalized.slice(0, 8)}...${normalized.slice(-4)}`;
  return `${normalized.slice(0, 25)}...`;
}

type DistributionTooltipProps = {
  active?: boolean;
  payload?: Array<{ payload?: { key?: string; count?: number; percent?: number } }>;
};

function DistributionTooltip({ active, payload }: DistributionTooltipProps): ReactElement | null {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="rounded-md border border-[#2b3139] bg-[#111417] px-3 py-2 text-xs shadow-sm">
      <div className="max-w-[320px] break-all font-mono text-[#eef2f8]">{row.key ?? "unknown"}</div>
      <div className="mt-1 text-[#9aa5b8]">
        {row.count ?? 0} events · {row.percent ?? 0}%
      </div>
    </div>
  );
}

function StateCard({ detail, title }: { detail: string; title: string }): ReactElement {
  return (
    <Card className="rounded-md">
      <CardContent className="py-8">
        <p className="font-medium">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function formatDate(value: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function payloadPreview(payload: unknown): string {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "";
  const record = payload as Record<string, unknown>;
  const safePayload = {
    eventName: stringValue(record.eventName),
    message: stringValue(record.message),
    skillId: stringValue(record.skillId),
    threadId: stringValue(record.threadId),
    parentThreadId: stringValue(record.parentThreadId),
    childThreadId: stringValue(record.childThreadId),
    pendingWorktreeId: stringValue(record.pendingWorktreeId),
    paths: Array.isArray(record.paths)
      ? record.paths.filter((entry): entry is string => typeof entry === "string").slice(0, 5)
      : undefined,
  };
  const entries = Object.entries(safePayload).filter(([, value]) =>
    Array.isArray(value) ? value.length > 0 : Boolean(value),
  );
  if (entries.length === 0) return "redacted";
  try {
    return JSON.stringify(Object.fromEntries(entries)).slice(0, 220);
  } catch {
    return "[unserializable]";
  }
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 140) : undefined;
}
