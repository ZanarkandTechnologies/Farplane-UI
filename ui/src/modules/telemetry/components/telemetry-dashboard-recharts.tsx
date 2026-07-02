"use client";

import {
  Bar as RechartsBar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Cell,
  Line as RechartsLine,
  LineChart as RechartsLineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import { useState, type ReactElement } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDuration, formatHours } from "../telemetry-dashboard-format";
import type { TelemetrySummary } from "../telemetry-dashboard-types";

type ChartMode = "agent-hours" | "capacity" | "source-map" | "parallel" | "projects" | "longest" | "availability";
type ChartRange = 7 | 30;

type DailyDatum = TelemetrySummary["dailyBuckets"][number] & {
  capacityHours: number;
  capacityPercent: number;
  longestHours: number;
};

const MS_PER_HOUR = 60 * 60 * 1000;
const THREE_HOURS = 3;
const CHART_CLASS_NAME = "aspect-auto h-full min-h-[260px] w-full";
const mutedCursorFill = "color-mix(in oklab, var(--muted) 35%, transparent)";
const mutedFill = "var(--muted)";

const CHART_MODES: Array<{ label: string; value: ChartMode }> = [
  { label: "Agent-hours", value: "agent-hours" },
  { label: "Capacity", value: "capacity" },
  { label: "Source map", value: "source-map" },
  { label: "Parallel", value: "parallel" },
  { label: "Projects", value: "projects" },
  { label: "Longest", value: "longest" },
  { label: "Availability", value: "availability" },
];

const hoursConfig = {
  agentHours: { color: "var(--chart-1)", label: "Agent-hours" },
  completedTurnCount: { color: "var(--chart-2)", label: "Turns" },
} satisfies ChartConfig;

const capacityConfig = {
  capacityPercent: { color: "var(--chart-2)", label: "Capacity %" },
  agentHours: { color: "var(--chart-1)", label: "Agent-hours" },
} satisfies ChartConfig;

const parallelConfig = {
  peakConcurrentSessions: { color: "var(--chart-1)", label: "Sessions" },
  peakConcurrentProjects: { color: "var(--chart-2)", label: "Projects" },
} satisfies ChartConfig;

const projectsConfig = {
  projectCount: { color: "var(--chart-1)", label: "Projects" },
} satisfies ChartConfig;

const longestConfig = {
  longestHours: { color: "var(--chart-1)", label: "Longest turn" },
} satisfies ChartConfig;

export function TelemetryDashboardView({
  data,
  mode,
}: {
  data: TelemetrySummary;
  mode: "global" | "team";
}): ReactElement {
  const [activeMode, setActiveMode] = useState<ChartMode>("agent-hours");
  const [range, setRange] = useState<ChartRange>(30);
  const dailyData = buildDailyData(data).slice(-range);
  const focus = getFocus(activeMode, dailyData, data);

  const layoutClassName =
    mode === "global"
      ? "grid h-full min-h-0 gap-3 xl:grid-cols-[minmax(0,1fr)_300px]"
      : "grid h-full min-h-0 gap-3";

  return (
    <div className={layoutClassName}>
      <Card className="flex min-h-0 flex-col rounded-md">
        <CardHeader className="shrink-0 gap-2 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
              <CardTitle className="text-sm uppercase tracking-normal">{focus.title}</CardTitle>
              <p className="text-2xl font-semibold tabular-nums">{focus.value}</p>
              <p className="max-w-2xl truncate text-xs text-muted-foreground">{focus.detail}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button aria-pressed={range === 7} onClick={() => setRange(7)} size="sm" variant={range === 7 ? "default" : "outline"}>
                7d
              </Button>
              <Button aria-pressed={range === 30} onClick={() => setRange(30)} size="sm" variant={range === 30 ? "default" : "outline"}>
                30d
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {CHART_MODES.map((item) => (
              <Button aria-pressed={activeMode === item.value} key={item.value} onClick={() => setActiveMode(item.value)} size="sm" variant={activeMode === item.value ? "default" : "outline"}>
                {item.label}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 px-4 pb-4">{renderChart(activeMode, dailyData, data)}</CardContent>
      </Card>
      {mode === "global" ? (
        <div className="grid min-h-0 content-start gap-3 overflow-hidden">
          <LifecycleHealth data={data} />
          <ContributionPanel data={data} mode={mode} />
        </div>
      ) : null}
    </div>
  );
}

function renderChart(activeMode: ChartMode, dailyData: DailyDatum[], data: TelemetrySummary): ReactElement {
  if (activeMode === "capacity") return <CapacityChart data={dailyData} />;
  if (activeMode === "source-map") return <SourceMapChart data={data} />;
  if (activeMode === "parallel") return <ParallelChart data={dailyData} />;
  if (activeMode === "projects") return <ProjectBreadthChart data={dailyData} />;
  if (activeMode === "longest") return <LongestTurnChart data={dailyData} />;
  if (activeMode === "availability") return <AvailabilityChart data={data} />;
  return <AgentHoursChart data={dailyData} />;
}

function AgentHoursChart({ data }: { data: DailyDatum[] }): ReactElement {
  return (
    <ChartContainer className={CHART_CLASS_NAME} config={hoursConfig}>
      <RechartsLineChart data={data} margin={{ bottom: 8, left: 8, right: 16, top: 16 }}>
        <CartesianGrid strokeDasharray="4 6" vertical={false} />
        <XAxis axisLine={false} dataKey="label" interval="preserveStartEnd" tickLine={false} tickMargin={8} />
        <YAxis dataKey="agentHours" domain={[0, "dataMax"]} hide yAxisId="hours" />
        <YAxis allowDecimals={false} dataKey="completedTurnCount" domain={[0, "dataMax"]} hide yAxisId="turns" />
        <ChartTooltip content={<ChartTooltipContent />} cursor={{ strokeDasharray: "4 4" }} />
        <RechartsLine dataKey="agentHours" dot={false} isAnimationActive={false} stroke="var(--color-agentHours)" strokeWidth={2.5} type="monotone" yAxisId="hours" />
        <RechartsLine
          dataKey="completedTurnCount"
          dot={false}
          isAnimationActive={false}
          stroke="var(--color-completedTurnCount)"
          strokeDasharray="5 6"
          strokeOpacity={0.5}
          strokeWidth={1.25}
          type="monotone"
          yAxisId="turns"
        />
      </RechartsLineChart>
    </ChartContainer>
  );
}

function CapacityChart({ data }: { data: DailyDatum[] }): ReactElement {
  return (
    <ChartContainer className={CHART_CLASS_NAME} config={capacityConfig}>
      <RechartsBarChart data={data} margin={{ bottom: 8, left: 8, right: 16, top: 16 }}>
        <CartesianGrid strokeDasharray="4 6" vertical={false} />
        <XAxis axisLine={false} dataKey="label" interval="preserveStartEnd" tickLine={false} tickMargin={8} />
        <YAxis domain={[0, 100]} hide />
        <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: mutedCursorFill }} />
        <RechartsBar dataKey="capacityPercent" isAnimationActive={false} radius={2}>
          {data.map((bucket) => (
            <Cell fill={getCapacityColor(bucket.capacityPercent)} key={bucket.dayKey} />
          ))}
        </RechartsBar>
      </RechartsBarChart>
    </ChartContainer>
  );
}

function SourceMapChart({ data }: { data: TelemetrySummary }): ReactElement {
  const maxHours = Math.max(1, ...data.hourlyBuckets.map((bucket) => bucket.agentHours));

  return (
    <div className="flex h-full min-h-[260px] flex-col justify-between gap-4" data-telemetry-source-heatmap>
      <div className="grid flex-1 grid-cols-12 gap-2">
        {data.hourlyBuckets.map((bucket) => {
          const ratio = bucket.agentHours / maxHours;
          return (
            <div
              aria-label={`${bucket.rangeLabel}: ${formatHours(bucket.agentHours)} from ${bucket.completedTurnCount} turns`}
              className="flex min-h-[72px] flex-col justify-between border p-2"
              key={bucket.hourKey}
              role="img"
              style={{ backgroundColor: getIntensityColor(ratio) }}
              title={`${bucket.rangeLabel}\n${formatHours(bucket.agentHours)} from ${bucket.completedTurnCount} turns\nTop project: ${bucket.topProjectDisplayName ?? "none"}`}
            >
              <span className="text-[10px] text-muted-foreground">{bucket.label}</span>
              <span className="text-sm font-semibold tabular-nums">{bucket.agentHours > 0 ? formatHours(bucket.agentHours) : "-"}</span>
              <span className="truncate text-[10px] text-muted-foreground">{bucket.topProjectDisplayName ?? "quiet"}</span>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
        <span>Last 24 stop hours</span>
        <HeatLegend items={["quiet", "low", "medium", "high"]} />
      </div>
    </div>
  );
}

function ParallelChart({ data }: { data: DailyDatum[] }): ReactElement {
  return (
    <ChartContainer className={CHART_CLASS_NAME} config={parallelConfig}>
      <RechartsLineChart data={data} margin={{ bottom: 8, left: 8, right: 16, top: 16 }}>
        <CartesianGrid strokeDasharray="4 6" vertical={false} />
        <XAxis axisLine={false} dataKey="label" interval="preserveStartEnd" tickLine={false} tickMargin={8} />
        <YAxis allowDecimals={false} hide />
        <ChartTooltip content={<ChartTooltipContent />} cursor={{ strokeDasharray: "4 4" }} />
        <RechartsLine dataKey="peakConcurrentSessions" isAnimationActive={false} stroke="var(--color-peakConcurrentSessions)" strokeWidth={2} type="monotone" />
        <RechartsLine dataKey="peakConcurrentProjects" isAnimationActive={false} stroke="var(--color-peakConcurrentProjects)" strokeWidth={2} type="monotone" />
      </RechartsLineChart>
    </ChartContainer>
  );
}

function ProjectBreadthChart({ data }: { data: DailyDatum[] }): ReactElement {
  return (
    <ChartContainer className={CHART_CLASS_NAME} config={projectsConfig}>
      <RechartsBarChart data={data} margin={{ bottom: 8, left: 8, right: 16, top: 16 }}>
        <CartesianGrid strokeDasharray="4 6" vertical={false} />
        <XAxis axisLine={false} dataKey="label" interval="preserveStartEnd" tickLine={false} tickMargin={8} />
        <YAxis allowDecimals={false} hide />
        <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: mutedCursorFill }} />
        <RechartsBar dataKey="projectCount" fill="var(--color-projectCount)" isAnimationActive={false} radius={2} />
      </RechartsBarChart>
    </ChartContainer>
  );
}

function LongestTurnChart({ data }: { data: DailyDatum[] }): ReactElement {
  return (
    <ChartContainer className={CHART_CLASS_NAME} config={longestConfig}>
      <RechartsLineChart data={data} margin={{ bottom: 8, left: 8, right: 16, top: 16 }}>
        <CartesianGrid strokeDasharray="4 6" vertical={false} />
        <XAxis axisLine={false} dataKey="label" interval="preserveStartEnd" tickLine={false} tickMargin={8} />
        <YAxis hide />
        <ReferenceLine stroke="var(--border)" strokeDasharray="6 8" y={THREE_HOURS} />
        <ChartTooltip content={<ChartTooltipContent />} cursor={{ strokeDasharray: "4 4" }} />
        <RechartsLine dataKey="longestHours" isAnimationActive={false} stroke="var(--color-longestHours)" strokeWidth={2} type="monotone" />
      </RechartsLineChart>
    </ChartContainer>
  );
}

function AvailabilityChart({ data }: { data: TelemetrySummary }): ReactElement {
  const counts = data.availabilityHours.reduce(
    (accumulator, bucket) => ({
      covered: accumulator.covered + (bucket.status === "covered" ? 1 : 0),
      missing: accumulator.missing + (bucket.status === "missing" ? 1 : 0),
      pending: accumulator.pending + (bucket.status === "pending" ? 1 : 0),
    }),
    { covered: 0, missing: 0, pending: 0 },
  );

  return (
    <div className="flex h-full min-h-[260px] flex-col gap-4" data-telemetry-availability-heatmap>
      <div className="grid grid-cols-3 gap-2">
        <StatusStat label="Covered" value={`${counts.covered}h`} variant="covered" />
        <StatusStat label="Missing" value={`${counts.missing}h`} variant="missing" />
        <StatusStat label="Pending" value={`${counts.pending}h`} variant="pending" />
      </div>
      <div className="grid flex-1 grid-cols-12 gap-2">
        {data.availabilityHours.map((bucket) => (
          <div
            aria-label={`${bucket.rangeLabel}: ${bucket.status}, ${bucket.pingCount} telemetry pings`}
            className={`flex min-h-[74px] flex-col justify-between border p-2 ${getAvailabilityClassName(bucket.status)}`}
            key={bucket.hourKey}
            role="img"
            title={`${bucket.rangeLabel}\n${bucket.status}\n${bucket.pingCount} telemetry pings`}
          >
            <span className="text-[10px] uppercase text-current/70">{bucket.label}</span>
            <span className="text-xs font-semibold capitalize">{bucket.status}</span>
            <span className="text-[10px] tabular-nums text-current/75">{bucket.pingCount} ping{bucket.pingCount === 1 ? "" : "s"}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
        <span>Today by local hour</span>
        <span className="inline-flex items-center gap-1"><span className="size-2 bg-emerald-500/80" />covered</span>
        <span className="inline-flex items-center gap-1"><span className="size-2 bg-destructive/80" />missing</span>
        <span className="inline-flex items-center gap-1"><span className="size-2 bg-amber-400/75" />pending</span>
      </div>
    </div>
  );
}

function LifecycleHealth({ data }: { data: TelemetrySummary }): ReactElement {
  const rows = [
    { label: "Completed", value: data.stats.completedTurnCount, detail: formatHours(data.stats.agentHours) },
    { label: "Filtered", value: data.stats.filteredTurnCount, detail: `${formatHours(data.stats.filteredAgentHours)} excluded` },
    { label: "Open", value: data.stats.inProgressTurnCount, detail: "diagnostic" },
    { label: "Unmatched", value: data.stats.unmatchedTurnCount, detail: "diagnostic" },
  ];
  const max = Math.max(1, ...rows.map((row) => row.value));

  return (
    <Card className="rounded-md">
      <CardHeader className="px-4 py-3">
        <CardTitle className="text-sm uppercase tracking-normal">Lifecycle Health</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 px-4 pb-4">
        {rows.map((row) => (
          <div key={row.label}>
            <div className="flex items-center justify-between gap-3 text-xs">
              <span>{row.label}</span>
              <span className="tabular-nums text-muted-foreground">{row.value} / {row.detail}</span>
            </div>
            <Progress className="mt-1" value={(row.value / max) * 100} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ContributionPanel({ data, mode }: { data: TelemetrySummary; mode: "global" | "team" }): ReactElement {
  const [scope, setScope] = useState("all");
  const scopedRows =
    scope === "all"
      ? data.projectBreakdown
      : data.projectBreakdownByDay[scope] ?? [];
  const rows = (mode === "team" ? scopedRows : scopedRows.slice(0, 4)).slice(0, 5);
  const maxHours = Math.max(1, ...rows.map((row) => row.agentHours));

  return (
    <Card className="rounded-md">
      <CardHeader className="gap-3 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-sm uppercase tracking-normal">{mode === "team" ? "Project Contribution" : "Top Projects"}</CardTitle>
          <Select value={scope} onValueChange={setScope}>
            <SelectTrigger aria-label="Contribution scope" size="sm" className="w-[132px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All days</SelectItem>
              {data.dailyBuckets.map((bucket) => (
                <SelectItem key={bucket.dayKey} value={bucket.dayKey}>
                  {bucket.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="grid gap-2 px-4 pb-4">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No completed project telemetry yet.</p>
        ) : (
          rows.map((row) => (
            <div key={row.key}>
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="truncate">{row.displayName}</span>
                <span className="tabular-nums text-muted-foreground">{formatHours(row.agentHours)}</span>
              </div>
              <Progress className="mt-1" value={(row.agentHours / maxHours) * 100} />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function StatusStat({
  label,
  value,
  variant,
}: {
  label: string;
  value: string;
  variant: "covered" | "missing" | "pending";
}): ReactElement {
  return (
    <div className={`border px-3 py-2 ${getAvailabilityClassName(variant)}`}>
      <div className="text-[10px] uppercase text-current/70">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function HeatLegend({ items }: { items: string[] }): ReactElement {
  return (
    <span className="inline-flex items-center gap-1.5">
      {items.map((item, index) => (
        <span className="inline-flex items-center gap-1" key={item}>
          <span
            className="size-2 border"
            style={{ backgroundColor: getIntensityColor(index / Math.max(1, items.length - 1)) }}
          />
          {item}
        </span>
      ))}
    </span>
  );
}

function buildDailyData(data: TelemetrySummary): DailyDatum[] {
  return data.dailyBuckets.map((bucket) => {
    const capacityHours = bucket.projectCount * 24;
    return {
      ...bucket,
      capacityHours,
      capacityPercent: capacityHours > 0 ? Math.round((bucket.agentHours / capacityHours) * 100) : 0,
      longestHours: (bucket.longestTurnDurationMs ?? 0) / MS_PER_HOUR,
    };
  });
}

function getFocus(activeMode: ChartMode, dailyData: DailyDatum[], data: TelemetrySummary): { detail: string; title: string; value: string } {
  const latest = dailyData[dailyData.length - 1];
  if (activeMode === "capacity") {
    return {
      detail: latest ? `${formatHours(latest.agentHours)} of ${formatHours(latest.capacityHours)} daily project capacity.` : "Waiting for completed projects.",
      title: "Daily Capacity",
      value: latest ? `${latest.capacityPercent}%` : "0%",
    };
  }
  if (activeMode === "source-map") {
    const total = data.hourlyBuckets.reduce((sum, bucket) => sum + bucket.agentHours, 0);
    const peak = [...data.hourlyBuckets].sort((left, right) => right.agentHours - left.agentHours)[0];
    return {
      detail: peak && peak.agentHours > 0 ? `Peak activity ${peak.rangeLabel}; ${peak.topProjectDisplayName ?? "no project"} led the bucket.` : "Waiting for completed stop hooks.",
      title: "Activity Heatmap",
      value: formatHours(total),
    };
  }
  if (activeMode === "parallel") {
    const best = [...dailyData].sort((left, right) => right.peakConcurrentSessions - left.peakConcurrentSessions)[0];
    return {
      detail: "Peak overlapping completed sessions and projects in the selected range.",
      title: "Parallel Control",
      value: best ? `${best.peakConcurrentSessions}S / ${best.peakConcurrentProjects}P` : "0S / 0P",
    };
  }
  if (activeMode === "projects") {
    const best = [...dailyData].sort((left, right) => right.projectCount - left.projectCount)[0];
    return {
      detail: "Distinct projects with completed turns per local day.",
      title: "Project Breadth",
      value: best ? `${best.projectCount}P` : "0P",
    };
  }
  if (activeMode === "longest") {
    const best = [...dailyData].sort((left, right) => right.longestHours - left.longestHours)[0];
    return {
      detail: "Daily max completed turn duration with a 3h reference line.",
      title: "Longest Single Turn",
      value: best?.longestTurnDurationMs ? formatDuration(best.longestTurnDurationMs) : "Waiting",
    };
  }
  if (activeMode === "availability") {
    const covered = data.availabilityHours.filter((bucket) => bucket.status === "covered").length;
    const missing = data.availabilityHours.filter((bucket) => bucket.status === "missing").length;
    return {
      detail: `${missing} elapsed local hour${missing === 1 ? "" : "s"} without telemetry coverage.`,
      title: "Availability Heatmap",
      value: `${covered}/24h`,
    };
  }
  return {
    detail: latest ? `${latest.label}: ${formatHours(latest.agentHours)} from ${latest.completedTurnCount} turns.` : "Waiting for completed agent-hours.",
    title: "Agent-Hours",
    value: formatHours(data.agentHourSummary.todayHours),
  };
}

function getCapacityColor(value: number): string {
  if (value >= 75) return "var(--chart-1)";
  if (value >= 35) return "var(--chart-2)";
  if (value > 0) return "var(--chart-3)";
  return mutedFill;
}

function getIntensityColor(ratio: number): string {
  if (ratio >= 0.75) return "var(--chart-1)";
  if (ratio >= 0.5) return "var(--chart-2)";
  if (ratio >= 0.25) return "var(--chart-3)";
  if (ratio > 0) return "var(--chart-4)";
  return mutedFill;
}

function getAvailabilityClassName(status: TelemetrySummary["availabilityHours"][number]["status"]): string {
  if (status === "covered") return "border-emerald-500/30 bg-emerald-500/20 text-emerald-100";
  if (status === "missing") return "border-destructive/35 bg-destructive/20 text-red-100";
  return "border-amber-400/30 bg-amber-400/15 text-amber-100";
}
