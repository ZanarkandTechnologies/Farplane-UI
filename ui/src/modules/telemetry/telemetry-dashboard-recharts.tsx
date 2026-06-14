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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TelemetrySummary } from "./telemetry-dashboard-types";
import { formatDuration, formatHours } from "./telemetry-dashboard-format";

type ChartMode = "agent-hours" | "capacity" | "source-map" | "parallel" | "projects" | "longest" | "availability";
type ChartRange = 7 | 30;

type DailyDatum = TelemetrySummary["dailyBuckets"][number] & {
  capacityHours: number;
  capacityPercent: number;
  longestHours: number;
};

type HourDatum = TelemetrySummary["hourlyBuckets"][number] & {
  fill: string;
};

const MS_PER_HOUR = 60 * 60 * 1000;
const THREE_HOURS = 3;
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

const availabilityConfig = {
  availabilityPercent: { color: "var(--chart-1)", label: "Availability" },
} satisfies ChartConfig;

const hourlyConfig = {
  agentHours: { color: "var(--chart-1)", label: "Agent-hours" },
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

  return (
    <ScrollArea className="h-full pr-3">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <Card className="rounded-md">
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-sm uppercase tracking-normal">{focus.title}</CardTitle>
                <p className="mt-2 text-3xl font-semibold tabular-nums">{focus.value}</p>
                <p className="mt-1 max-w-2xl text-xs text-muted-foreground">{focus.detail}</p>
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
          <CardContent>{renderChart(activeMode, dailyData, data)}</CardContent>
        </Card>
        <div className="grid content-start gap-3">
          <LifecycleHealth data={data} />
          <ContributionPanel data={data} mode={mode} />
        </div>
      </div>
    </ScrollArea>
  );
}

function renderChart(activeMode: ChartMode, dailyData: DailyDatum[], data: TelemetrySummary): ReactElement {
  if (activeMode === "capacity") return <CapacityChart data={dailyData} />;
  if (activeMode === "source-map") return <SourceMapChart data={data} />;
  if (activeMode === "parallel") return <ParallelChart data={dailyData} />;
  if (activeMode === "projects") return <ProjectBreadthChart data={dailyData} />;
  if (activeMode === "longest") return <LongestTurnChart data={dailyData} />;
  if (activeMode === "availability") return <AvailabilityChart data={dailyData} />;
  return <AgentHoursChart data={dailyData} />;
}

function AgentHoursChart({ data }: { data: DailyDatum[] }): ReactElement {
  return (
    <ChartContainer className="aspect-auto h-72 w-full" config={hoursConfig}>
      <RechartsLineChart data={data} margin={{ bottom: 8, left: 8, right: 16, top: 16 }}>
        <CartesianGrid strokeDasharray="4 6" vertical={false} />
        <XAxis axisLine={false} dataKey="label" interval="preserveStartEnd" tickLine={false} tickMargin={8} />
        <YAxis hide />
        <ChartTooltip content={<ChartTooltipContent />} cursor={{ strokeDasharray: "4 4" }} />
        <RechartsLine dataKey="agentHours" dot={false} isAnimationActive={false} stroke="var(--color-agentHours)" strokeWidth={2} type="monotone" />
        <RechartsLine dataKey="completedTurnCount" dot={false} isAnimationActive={false} stroke="var(--color-completedTurnCount)" strokeWidth={1.5} type="monotone" />
      </RechartsLineChart>
    </ChartContainer>
  );
}

function CapacityChart({ data }: { data: DailyDatum[] }): ReactElement {
  return (
    <ChartContainer className="aspect-auto h-72 w-full" config={capacityConfig}>
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
  const chartData: HourDatum[] = data.hourlyBuckets.map((bucket) => ({
    ...bucket,
    fill: getIntensityColor(bucket.agentHours / maxHours),
  }));

  return (
    <ChartContainer className="aspect-auto h-72 w-full" config={hourlyConfig}>
      <RechartsBarChart data={chartData} margin={{ bottom: 8, left: 8, right: 16, top: 16 }}>
        <CartesianGrid strokeDasharray="4 6" vertical={false} />
        <XAxis axisLine={false} dataKey="label" interval="preserveStartEnd" tickLine={false} tickMargin={8} />
        <YAxis hide />
        <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: mutedCursorFill }} />
        <RechartsBar dataKey="agentHours" isAnimationActive={false} radius={2}>
          {chartData.map((bucket) => (
            <Cell fill={bucket.fill} key={bucket.hourKey} />
          ))}
        </RechartsBar>
      </RechartsBarChart>
    </ChartContainer>
  );
}

function ParallelChart({ data }: { data: DailyDatum[] }): ReactElement {
  return (
    <ChartContainer className="aspect-auto h-72 w-full" config={parallelConfig}>
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
    <ChartContainer className="aspect-auto h-72 w-full" config={projectsConfig}>
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
    <ChartContainer className="aspect-auto h-72 w-full" config={longestConfig}>
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

function AvailabilityChart({ data }: { data: DailyDatum[] }): ReactElement {
  return (
    <ChartContainer className="aspect-auto h-72 w-full" config={availabilityConfig}>
      <RechartsBarChart data={data} margin={{ bottom: 8, left: 8, right: 16, top: 16 }}>
        <CartesianGrid strokeDasharray="4 6" vertical={false} />
        <XAxis axisLine={false} dataKey="label" interval="preserveStartEnd" tickLine={false} tickMargin={8} />
        <YAxis domain={[0, 100]} hide />
        <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: mutedCursorFill }} />
        <RechartsBar dataKey="availabilityPercent" fill="var(--color-availabilityPercent)" isAnimationActive={false} radius={2} />
      </RechartsBarChart>
    </ChartContainer>
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
      <CardHeader>
        <CardTitle className="text-sm uppercase tracking-normal">Lifecycle Health</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
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
  const rows = mode === "team" ? scopedRows : scopedRows.slice(0, 6);
  const maxHours = Math.max(1, ...rows.map((row) => row.agentHours));

  return (
    <Card className="rounded-md">
      <CardHeader className="gap-3">
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
      <CardContent className="grid gap-3">
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
      detail: peak && peak.agentHours > 0 ? `Peak stop hour ${peak.rangeLabel}; ${peak.topProjectDisplayName ?? "no project"} led the bucket.` : "Waiting for completed stop hooks.",
      title: "Last 24h Source Map",
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
    const avg = Math.round(dailyData.reduce((sum, bucket) => sum + bucket.availabilityPercent, 0) / Math.max(1, dailyData.length));
    return {
      detail: latest ? `Today has ${latest.coveredHours}/24 covered hours.` : "Waiting for hook coverage.",
      title: "Availability",
      value: `${avg}% avg`,
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
