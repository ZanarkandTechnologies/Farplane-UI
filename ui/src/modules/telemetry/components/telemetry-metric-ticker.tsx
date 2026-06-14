"use client";

/**
 * TELEMETRY METRIC TICKER
 * =======================
 * Ownership: Telemetry module.
 * Inputs: reduced runtime telemetry summary.
 * Outputs: looping compact metric rail for the telemetry dashboard chrome.
 * Side effects: none.
 * Invariants: ticker repeats enough groups to cover wide modal viewports.
 */

import {
  Activity as ActivityIcon,
  AlertTriangle as AlertTriangleIcon,
  BarChart3,
  Clock,
  Database,
  GitBranch,
  Network,
  Timer,
} from "lucide-react";
import type { ReactElement } from "react";
import {
  formatDeltaHours,
  formatDuration,
  formatHours,
  formatRelativeTime,
} from "../telemetry-dashboard-format";
import type { TelemetrySummary } from "../telemetry-dashboard-types";

type TelemetryMetricGridProps = {
  data: TelemetrySummary;
};

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
    <section aria-label="Runtime telemetry metrics" className="telemetry-ticker relative overflow-hidden border bg-card/70">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l from-background to-transparent" />
      <div className="telemetry-ticker-track flex w-max items-stretch py-1.5">
        {[0, 1, 2].map((setIndex) => (
          <div aria-hidden={setIndex > 0} className="flex items-stretch" key={setIndex}>
            {metrics.map((metric) => (
              <div className="grid w-[132px] shrink-0 grid-rows-2 gap-0.5 border-r px-3 text-xs" key={`${setIndex}-${metric.label}`}>
                <div className="flex min-w-0 items-center gap-1.5">
                  <metric.icon className="size-3 text-muted-foreground" />
                  <span className="truncate text-[10px] uppercase text-muted-foreground">{metric.label}</span>
                </div>
                <div className="flex min-w-0 items-baseline gap-1.5">
                  <span className="shrink-0 text-sm font-semibold leading-none tabular-nums">{metric.value}</span>
                  <span className="truncate text-[10px] leading-none text-muted-foreground">{metric.detail}</span>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
