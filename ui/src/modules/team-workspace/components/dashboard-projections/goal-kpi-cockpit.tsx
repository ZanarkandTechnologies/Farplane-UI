"use client";

import { ExternalLink, Gauge, Info } from "lucide-react";
import type { ReactElement } from "react";
import { Area, Bar, CartesianGrid, ComposedChart, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { GoalAxisView, KpiMetricRow } from "../../lib/dashboard-projections/goal-kpi-model";
import {
  buildRollingSevenDayChartData,
  formatMetricValue,
  metricRowState,
  metricStateLabel,
  metricTargetHit,
  targetCopy,
  trendLabel,
} from "./goal-kpi-cockpit-model";

type KpiChartMode = "observations" | "cumulative";

function sourceGapCopy(metric: KpiMetricRow | null, gapReason: string | null): string | null {
  if (gapReason) return gapReason;
  const sourceGapCount = metric?.sourceGapIds?.length ?? 0;
  if (sourceGapCount > 0) {
    return `${sourceGapCount} source gap${sourceGapCount === 1 ? "" : "s"} in snapshot`;
  }
  return null;
}

function rowStateClasses(state: "hit" | "gap" | "active"): string {
  if (state === "hit") return "bg-emerald-500/10 hover:bg-emerald-500/15";
  if (state === "gap") return "bg-amber-500/10 hover:bg-amber-500/15";
  return "hover:bg-muted/20";
}

function stateBadgeVariant(
  state: "hit" | "gap" | "active",
): "outline" | "secondary" | "destructive" {
  if (state === "hit") return "outline";
  if (state === "gap") return "secondary";
  return "outline";
}

function stateLabel(state: "hit" | "gap" | "active", status: string): string {
  if (state === "hit") return "hit";
  if (state === "gap") return "gap";
  return metricStateLabel(status).toLowerCase();
}

function KpiTrendChart({
  metric,
  mode,
}: {
  metric: KpiMetricRow;
  mode: KpiChartMode;
}): ReactElement {
  const points = metric.series;
  if (points.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-md border bg-background/40 text-xs text-muted-foreground">
        no series
      </div>
    );
  }
  const chartData = buildRollingSevenDayChartData(metric);
  const showObservations = mode === "observations";
  return (
    <ChartContainer
      className="h-32 w-full rounded-md border bg-background/40 px-2 py-2"
      config={{
        value: { color: "var(--primary)", label: "Observed value" },
        cumulative: { color: "var(--muted-foreground)", label: "Cumulative" },
      }}
      initialDimension={{ width: 360, height: 128 }}
    >
      <ComposedChart data={chartData} margin={{ bottom: 4, left: 2, right: 2, top: 4 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="label"
          interval={2}
          tickLine={false}
          axisLine={false}
          tickMargin={2}
          minTickGap={6}
        />
        <YAxis hide domain={["auto", "auto"]} />
        <ChartTooltip
          content={<ChartTooltipContent />}
          cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
        />
        {showObservations ? (
          <Bar dataKey="value" fill="var(--color-value)" radius={[2, 2, 0, 0]} />
        ) : (
          <Area
            dataKey="cumulative"
            fill="var(--color-cumulative)"
            fillOpacity={0.12}
            stroke="var(--color-cumulative)"
            strokeWidth={2}
            type="monotone"
          />
        )}
      </ComposedChart>
    </ChartContainer>
  );
}

function MetricBreakdown({ metric }: { metric: KpiMetricRow }): ReactElement | null {
  const items = metric.series.flatMap((point) =>
    point.items.map((item) => ({ ...item, date: point.date })),
  );
  if (items.length === 0) return null;
  return (
    <details className="rounded-md border bg-background/40 p-2 text-xs">
      <summary className="cursor-pointer text-muted-foreground">
        {items.length} content breakdown item{items.length === 1 ? "" : "s"}
      </summary>
      <div className="mt-2 space-y-1">
        {items.slice(0, 8).map((item) => (
          <div
            key={`${item.date}:${item.id}:${item.value}`}
            className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-sm border bg-muted/20 p-2"
          >
            <div className="min-w-0">
              <p className="break-all font-mono [overflow-wrap:anywhere]">{item.id}</p>
              <p className="text-muted-foreground">
                {item.kind ?? "item"} · {item.date}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium tabular-nums">{formatMetricValue(item.value)}</span>
              {item.url ? (
                <Button asChild size="sm" variant="outline" className="h-7 px-2">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Open item"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}

function MiniTrendBars({ metric }: { metric: KpiMetricRow | null }): ReactElement {
  const points = metric ? buildRollingSevenDayChartData(metric) : [];
  const values = points
    .map((point) => point.value)
    .filter((value): value is number => typeof value === "number");
  const max = Math.max(...values.map((value) => Math.abs(value)), 1);
  if (points.length === 0 || values.length === 0) {
    return <span className="text-xs text-muted-foreground">no trend</span>;
  }
  return (
    <div
      className="flex h-8 items-end gap-1"
      role="img"
      aria-label={`7 day trend ${trendLabel(metric)}`}
    >
      {points.map((point) => {
        const value = point.value;
        const height = typeof value === "number" ? Math.max(15, (Math.abs(value) / max) * 100) : 8;
        return (
          <span
            key={point.date}
            className={
              typeof value === "number"
                ? "w-1.5 rounded-sm bg-primary/70"
                : "w-1.5 rounded-sm bg-muted-foreground/20"
            }
            style={{ height: `${height}%` }}
          />
        );
      })}
    </div>
  );
}

function MetricTitle({
  metric,
  metricId,
}: {
  metric: KpiMetricRow | null;
  metricId: string;
}): ReactElement {
  const label = metric?.label ?? metricId;
  const description = metric?.description?.trim();
  return (
    <div className="flex min-w-0 items-center gap-2">
      <p className="break-words text-sm font-semibold [overflow-wrap:anywhere]">{label}</p>
      {description ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`How ${label} is calculated`}
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-80 text-left leading-5">{description}</TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  );
}

type KpiTableEntry = {
  metricId: string;
  metric: KpiMetricRow | null;
  gapReason: string | null;
};

function emptyMetricRow(metricId: string, status: string): KpiMetricRow {
  return {
    metricId,
    label: metricId,
    axis: "",
    product: "",
    sourceId: "",
    status,
    current: null,
    currentStatus: status,
    type: "stock",
    windowStart: "",
    windowEnd: "",
    windowTimezone: "",
    previousValue: null,
    absoluteDelta: null,
    percentDelta: null,
    progressDelta: null,
    momentum: "unknown",
    cumulativeValue: null,
    target: null,
    targetHit: null,
    display: "",
    series: [],
    sourceGapIds: [],
  };
}

function KpiTableRow({ entry }: { entry: KpiTableEntry }): ReactElement {
  const { metricId, metric, gapReason } = entry;
  const status = metric?.status ?? (gapReason ? "source_gap" : "missing");
  const rowState = metricRowState(metric, status);
  const gapCopy = sourceGapCopy(metric, gapReason);
  const metricTargetCopy = targetCopy(metric);
  return (
    <details className="group border-t first:border-t-0">
      <summary
        className={cn(
          "grid cursor-pointer list-none gap-3 px-3 py-3 md:grid-cols-[minmax(12rem,1.6fr)_minmax(5rem,0.5fr)_minmax(8rem,0.8fr)_minmax(5rem,0.55fr)_minmax(5rem,0.45fr)]",
          rowStateClasses(rowState),
        )}
      >
        <div className="min-w-0 space-y-1">
          <MetricTitle metric={metric} metricId={metricId} />
          <p className="break-all font-mono text-xs text-muted-foreground">{metricId}</p>
          {gapCopy ? (
            <p className="break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
              Gap: {gapCopy}
            </p>
          ) : null}
        </div>
        <div className="text-sm tabular-nums">
          <span className="md:hidden text-xs text-muted-foreground">Current </span>
          {formatMetricValue(metric?.current ?? null)}
        </div>
        <div className="break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
          <span className="md:hidden text-xs">Target </span>
          {metricTargetCopy || "target not set"}
        </div>
        <div className="flex items-center gap-2">
          <MiniTrendBars metric={metric} />
          <span className="text-xs text-muted-foreground">{trendLabel(metric)}</span>
        </div>
        <div>
          <Badge
            variant={stateBadgeVariant(rowState)}
            className={rowState === "hit" ? "border-emerald-500/40 text-emerald-300" : ""}
          >
            {stateLabel(rowState, status)}
          </Badge>
        </div>
      </summary>
      <div className="grid gap-3 border-t bg-background/40 p-3 lg:grid-cols-2">
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Raw observations
          </p>
          <KpiTrendChart mode="observations" metric={metric ?? emptyMetricRow(metricId, status)} />
        </div>
        {metric?.type === "flow" ? (
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Cumulative · {formatMetricValue(metric.cumulativeValue)} through{" "}
              {metric.cumulativeThrough || metric.windowEnd}
            </p>
            <KpiTrendChart mode="cumulative" metric={metric} />
          </div>
        ) : (
          <div className="flex h-40 flex-col justify-center rounded-md border bg-background/40 p-4 text-sm">
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Window comparison
            </p>
            <p className="mt-2 tabular-nums">
              {formatMetricValue(metric?.previousValue ?? null)} →{" "}
              {formatMetricValue(metric?.current ?? null)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {trendLabel(metric)} · {metric?.comparisonReason || "previous window"}
            </p>
          </div>
        )}
        {metric ? (
          <div className="lg:col-span-2">
            <MetricBreakdown metric={metric} />
          </div>
        ) : null}
      </div>
    </details>
  );
}

function GoalKpiTable({ entries }: { entries: KpiTableEntry[] }): ReactElement {
  if (entries.length === 0) {
    return (
      <p className="rounded-md border bg-background/40 p-3 text-sm text-muted-foreground">
        No KPI IDs are attached to this SMART goal yet.
      </p>
    );
  }
  return (
    <div className="overflow-hidden rounded-md border bg-background/40">
      <div className="hidden grid-cols-[minmax(12rem,1.6fr)_minmax(5rem,0.5fr)_minmax(8rem,0.8fr)_minmax(5rem,0.55fr)_minmax(5rem,0.45fr)] gap-3 border-b bg-muted/20 px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground md:grid">
        <span>Metric</span>
        <span>Current</span>
        <span>Target</span>
        <span>Trend</span>
        <span>State</span>
      </div>
      {entries.map((entry) => (
        <KpiTableRow key={entry.metricId} entry={entry} />
      ))}
    </div>
  );
}

function goalProgress(entries: KpiTableEntry[]): { hit: number; total: number; complete: boolean } {
  const total = entries.length;
  const hit = entries.filter((entry) => metricTargetHit(entry.metric)).length;
  return { hit, total, complete: total > 0 && hit === total };
}

export function GoalKpiCockpit({
  axes,
  snapshotLabel,
}: {
  axes: GoalAxisView[];
  snapshotLabel: string;
}): ReactElement {
  return (
    <Card className="rounded-md">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Gauge className="h-4 w-4" />
            KPI Cockpit
          </CardTitle>
          <span className="text-xs text-muted-foreground">{snapshotLabel}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {axes.length > 0 ? (
          axes.map((axis) => (
            <section key={axis.id} className="space-y-3 rounded-md border bg-background/40 p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold [overflow-wrap:anywhere]">
                    {axis.label}
                  </p>
                  <p className="mt-1 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
                    {axis.question}
                  </p>
                </div>
                <Badge variant="outline">{axis.smartGoals.length} SMART goal(s)</Badge>
              </div>
              {axis.evidenceHints.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {axis.evidenceHints.slice(0, 5).map((hint) => (
                    <Badge key={hint} variant="secondary">
                      {hint}
                    </Badge>
                  ))}
                </div>
              ) : null}
              <div className="space-y-3">
                {axis.smartGoals.map((goal) => (
                  <GoalBlock key={goal.id} goal={goal} />
                ))}
              </div>
            </section>
          ))
        ) : (
          <p className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
            No goal axes found in the project snapshot.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function GoalBlock({ goal }: { goal: GoalAxisView["smartGoals"][number] }): ReactElement {
  const entries = goal.metrics.map((entry) => ({
    metricId: entry.metricId,
    metric: entry.metric,
    gapReason: entry.gap?.reason ?? null,
  }));
  const progress = goalProgress(entries);
  return (
    <div
      className={cn(
        "space-y-2 rounded-md border bg-muted/20 p-3",
        progress.complete ? "border-emerald-500/30 bg-emerald-500/10" : "",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Badge variant="outline">{goal.id}</Badge>
          <p className="mt-2 break-words text-sm font-medium [overflow-wrap:anywhere]">
            {goal.target}
          </p>
          {goal.interpretation ? (
            <p className="mt-2 break-words text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]">
              {goal.interpretation}
            </p>
          ) : null}
        </div>
        <Badge
          variant={progress.complete ? "outline" : "secondary"}
          className={progress.complete ? "border-emerald-500/40 text-emerald-300" : ""}
        >
          {progress.complete ? "complete" : `${progress.hit}/${progress.total} KPI hit`}
        </Badge>
      </div>
      <GoalKpiTable entries={entries} />
      {goal.updateHint ? (
        <p className="break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
          Update: {goal.updateHint}
        </p>
      ) : null}
    </div>
  );
}
