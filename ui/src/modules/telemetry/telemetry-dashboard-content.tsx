"use client";

/**
 * TELEMETRY DASHBOARD CONTENT
 * ===========================
 * Ownership: Telemetry module.
 * Inputs: Convex telemetry dashboard queries and optional team/project scope.
 * Outputs: compact shadcn-native runtime telemetry views.
 * Side effects: none beyond Convex subscriptions.
 * Invariants: UI displays completed agent hours separately from lifecycle diagnostics.
 */

import { useMemo, useState, type ReactElement } from "react";
import { useQuery } from "convex/react";
import { Activity, AlertTriangle, Clock, Database, GitBranch } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { isConvexEnabled } from "@/providers/convex-provider";

type RangeDays = 7 | 30 | 90;

type TelemetryBreakdown = {
  key: string;
  displayName: string;
  agentHours: number;
  completedTurnCount: number;
  inProgressTurnCount: number;
  unmatchedTurnCount: number;
  lastSeenAt: number | null;
};

type RuntimeTurn = {
  id: string;
  projectName: string | null;
  projectId: string | null;
  teamId: string | null;
  turnId: string;
  agentName: string | null;
  startedAt: number | null;
  endedAt: number | null;
  durationMs: number | null;
  status: "completed" | "in_progress" | "unmatched";
};

type TelemetrySummary = {
  stats: {
    agentHours: number;
    completedTurnCount: number;
    inProgressTurnCount: number;
    unmatchedTurnCount: number;
    projectCount: number;
    teamCount: number;
    totalPings: number;
    lastSeenAt: number | null;
  };
  projectBreakdown: TelemetryBreakdown[];
  teamBreakdown: TelemetryBreakdown[];
  dailyBuckets: Array<{
    dayKey: string;
    label: string;
    agentHours: number;
    completedTurnCount: number;
    projectCount: number;
    teamCount: number;
    totalPings: number;
  }>;
  recentTurns: RuntimeTurn[];
};

type TelemetryDashboardContentProps = {
  mode: "global" | "team";
  projectId?: string | null;
  teamId?: string | null;
  title?: string;
};

const RANGE_OPTIONS: Array<{ label: string; value: RangeDays }> = [
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
];

export function TelemetryDashboardContent({
  mode,
  projectId,
  teamId,
  title,
}: TelemetryDashboardContentProps): ReactElement {
  const convexEnabled = isConvexEnabled();
  const [rangeDays, setRangeDays] = useState<RangeDays>(30);
  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const globalData = useQuery(
    api.modules.runtimeTelemetry.telemetry.getTelemetryDashboard,
    convexEnabled && mode === "global" ? { rangeDays, timezone } : "skip",
  ) as TelemetrySummary | undefined;
  const teamData = useQuery(
    api.modules.runtimeTelemetry.telemetry.getTeamTelemetry,
    convexEnabled && mode === "team"
      ? { projectId: projectId ?? undefined, rangeDays, teamId: teamId ?? undefined, timezone }
      : "skip",
  ) as TelemetrySummary | undefined;
  const data = mode === "global" ? globalData : teamData;

  if (!convexEnabled) {
    return <TelemetryStateCard title="Telemetry unavailable" detail="Convex is not configured for this UI session." />;
  }

  if (data === undefined) {
    return <TelemetryStateCard title="Loading telemetry" detail="Reading runtime lifecycle rows..." />;
  }

  const peakDailyHours = Math.max(...data.dailyBuckets.map((bucket) => bucket.agentHours), 1);
  const diagnosticsCount = data.stats.inProgressTurnCount + data.stats.unmatchedTurnCount;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-lg font-semibold">
              {mode === "global" ? "Runtime Telemetry" : title || "Team Telemetry"}
            </h2>
            <Badge variant={diagnosticsCount > 0 ? "secondary" : "outline"}>
              {diagnosticsCount} diagnostic{diagnosticsCount === 1 ? "" : "s"}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Completed agent hours count matched lifecycle turns only.
          </p>
        </div>
        <Select value={String(rangeDays)} onValueChange={(value) => setRangeDays(Number(value) as RangeDays)}>
          <SelectTrigger size="sm" className="w-[120px]">
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
      </div>

      <TelemetryMetricGrid data={data} />

      <Tabs defaultValue="projects" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="w-fit">
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="teams">Teams</TabsTrigger>
          <TabsTrigger value="days">Days</TabsTrigger>
          <TabsTrigger value="turns">Turns</TabsTrigger>
        </TabsList>
        <TabsContent value="projects" className="min-h-0 flex-1">
          <BreakdownTable rows={data.projectBreakdown} emptyLabel="No project telemetry yet." />
        </TabsContent>
        <TabsContent value="teams" className="min-h-0 flex-1">
          <BreakdownTable rows={data.teamBreakdown} emptyLabel="No team telemetry yet." />
        </TabsContent>
        <TabsContent value="days" className="min-h-0 flex-1">
          <ScrollArea className="h-full pr-3">
            <div className="space-y-2">
              {data.dailyBuckets.map((bucket) => (
                <Card key={bucket.dayKey} className="gap-2 rounded-md py-3">
                  <CardContent className="px-4">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium">{bucket.label}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {formatHours(bucket.agentHours)} / {bucket.completedTurnCount} turns
                      </span>
                    </div>
                    <Progress className="mt-2" value={(bucket.agentHours / peakDailyHours) * 100} />
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
        <TabsContent value="turns" className="min-h-0 flex-1">
          <TurnsTable rows={data.recentTurns} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TelemetryMetricGrid({ data }: { data: TelemetrySummary }): ReactElement {
  const metrics = [
    {
      icon: Clock,
      label: "Agent hours",
      value: formatHours(data.stats.agentHours),
      detail: `${data.stats.completedTurnCount} completed turns`,
    },
    {
      icon: GitBranch,
      label: "Projects",
      value: String(data.stats.projectCount),
      detail: `${data.stats.teamCount} team scopes`,
    },
    {
      icon: Activity,
      label: "Open turns",
      value: String(data.stats.inProgressTurnCount),
      detail: "not counted as complete",
    },
    {
      icon: Database,
      label: "Pings",
      value: String(data.stats.totalPings),
      detail: data.stats.lastSeenAt ? `last ${formatRelativeTime(data.stats.lastSeenAt)}` : "no rows",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <Card key={metric.label} className="gap-3 rounded-md py-4">
          <CardHeader className="px-4 pb-0">
            <CardTitle className="flex items-center gap-2 text-xs font-medium uppercase tracking-normal text-muted-foreground">
              <metric.icon className="size-4" />
              {metric.label}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4">
            <div className="text-2xl font-semibold tabular-nums">{metric.value}</div>
            <div className="mt-1 text-xs text-muted-foreground">{metric.detail}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function BreakdownTable({
  rows,
  emptyLabel,
}: {
  rows: TelemetryBreakdown[];
  emptyLabel: string;
}): ReactElement {
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

function TurnsTable({ rows }: { rows: RuntimeTurn[] }): ReactElement {
  if (rows.length === 0) {
    return <TelemetryStateCard title="No turns yet" detail="Matched and diagnostic lifecycle turns will appear here." />;
  }

  return (
    <ScrollArea className="h-full pr-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Turn</TableHead>
            <TableHead>Project</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Duration</TableHead>
            <TableHead>Agent</TableHead>
            <TableHead>Ended</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((turn) => (
            <TableRow key={turn.id}>
              <TableCell className="max-w-[180px] truncate font-mono text-xs">{turn.turnId}</TableCell>
              <TableCell className="max-w-[220px] truncate">{turn.projectName ?? turn.projectId ?? "Unlabeled"}</TableCell>
              <TableCell>
                <Badge variant={turn.status === "completed" ? "outline" : "secondary"}>
                  {turn.status.replace("_", " ")}
                </Badge>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {turn.durationMs === null ? "open" : formatDuration(turn.durationMs)}
              </TableCell>
              <TableCell>{turn.agentName ?? "unknown"}</TableCell>
              <TableCell>{turn.endedAt ? formatRelativeTime(turn.endedAt) : "not ended"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}

function TelemetryStateCard({ title, detail }: { title: string; detail: string }): ReactElement {
  return (
    <Card className="mt-4 rounded-md">
      <CardContent className="flex items-center gap-3 pt-6 text-sm">
        <AlertTriangle className="size-4 text-muted-foreground" />
        <div>
          <div className="font-medium">{title}</div>
          <div className="text-xs text-muted-foreground">{detail}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function formatHours(value: number): string {
  if (value < 1) return `${Math.round(value * 60)}m`;
  return `${value.toFixed(value >= 10 ? 0 : 1)}h`;
}

function formatDuration(value: number): string {
  const minutes = Math.round(value / 60_000);
  if (minutes < 60) return `${minutes}m`;
  return `${(minutes / 60).toFixed(1)}h`;
}

function formatRelativeTime(timestamp: number): string {
  const deltaMs = Date.now() - timestamp;
  const minutes = Math.max(0, Math.round(deltaMs / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
