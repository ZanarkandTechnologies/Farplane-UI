"use client";

import { ExternalLink, Gauge } from "lucide-react";
import type { ReactElement } from "react";
import { Area, Bar, CartesianGrid, ComposedChart, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { GoalAxisView, KpiMetricRow } from "../../lib/dashboard-projections/goal-kpi-model";

const numberFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
type KpiChartMode = "daily" | "cumulative";
type KpiChartPoint = {
  date: string;
  label: string;
  current: number | null;
  dailyDiff: number | null;
};

function formatMetricValue(value: number | null): string {
  return typeof value === "number" && Number.isFinite(value) ? numberFormatter.format(value) : "-";
}

function latestDailyDiff(metric: KpiMetricRow | null): number | null {
  const latest = metric?.series.at(-1);
  return latest?.dailyDiff ?? null;
}

function formatDailyDiff(value: number | null): string {
  if (value === null) return "Today n/a";
  if (value > 0) return `Today +${numberFormatter.format(value)}`;
  return `Today ${numberFormatter.format(value)}`;
}

function metricBadgeVariant(status: string): "outline" | "secondary" | "destructive" {
  if (status === "available") return "outline";
  if (status === "source_gap" || status === "missing") return "secondary";
  return "destructive";
}

function diffBadgeVariant(value: number | null): "outline" | "secondary" | "destructive" {
  if (value === null || value === 0) return "secondary";
  return value > 0 ? "outline" : "destructive";
}

function targetProgress(metric: KpiMetricRow | null): number | null {
  if (
    !metric ||
    typeof metric.target !== "number" ||
    metric.target <= 0 ||
    metric.current === null
  ) {
    return null;
  }
  return Math.max(0, Math.min(100, (metric.current / metric.target) * 100));
}

function formatShortDate(date: Date): string {
  return `${date.getUTCMonth() + 1}/${date.getUTCDate()}`;
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function buildRollingSevenDayChartData(metric: KpiMetricRow): KpiChartPoint[] {
  const datedPoints = metric.series
    .map((point) => ({
      ...point,
      parsedDate: new Date(`${point.date}T00:00:00Z`),
    }))
    .filter((point) => !Number.isNaN(point.parsedDate.getTime()))
    .sort((left, right) => left.parsedDate.getTime() - right.parsedDate.getTime());
  const latestDate = datedPoints.at(-1)?.parsedDate;
  if (!latestDate) return [];
  const pointByDate = new Map(datedPoints.map((point) => [point.date, point]));
  const firstDate = addUtcDays(latestDate, -6);
  return Array.from({ length: 7 }, (_, index) => {
    const date = addUtcDays(firstDate, index);
    const key = date.toISOString().slice(0, 10);
    const point = pointByDate.get(key);
    return {
      date: key,
      label: formatShortDate(date),
      current: point?.current ?? null,
      dailyDiff: point?.dailyDiff ?? null,
    };
  });
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
      <div className="flex h-16 items-center justify-center rounded-md border bg-background/40 text-xs text-muted-foreground">
        no series
      </div>
    );
  }
  const chartData = buildRollingSevenDayChartData(metric);
  const isDaily = mode === "daily";
  return (
    <ChartContainer
      className="h-20 w-full rounded-md border bg-background/40 px-1 py-1"
      config={{
        current: { color: "var(--primary)", label: "Current" },
        dailyDiff: { color: "var(--muted-foreground)", label: "Daily diff" },
      }}
      initialDimension={{ width: 360, height: 80 }}
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
        {isDaily ? (
          <Bar dataKey="dailyDiff" fill="var(--color-dailyDiff)" radius={[2, 2, 0, 0]} />
        ) : (
          <Area
            dataKey="current"
            fill="var(--color-current)"
            fillOpacity={0.12}
            stroke="var(--color-current)"
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

function KpiRow({
  metricId,
  metric,
  gapReason,
  mode,
}: {
  metricId: string;
  metric: KpiMetricRow | null;
  gapReason: string | null;
  mode: KpiChartMode;
}): ReactElement {
  const status = metric?.status ?? (gapReason ? "source_gap" : "missing");
  const isAvailable = status === "available";
  const todayDiff = latestDailyDiff(metric);
  const progress = targetProgress(metric);
  const numericTarget = typeof metric?.target === "number" ? metric.target : null;
  const stringTarget = typeof metric?.target === "string" ? metric.target : null;
  const isDaily = mode === "daily";
  return (
    <div className="grid min-w-0 gap-3 rounded-md border bg-muted/20 p-3 xl:grid-cols-[minmax(12rem,0.8fr)_minmax(0,1.35fr)_minmax(10rem,0.8fr)]">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={metricBadgeVariant(status)}>{status}</Badge>
          <Badge variant="outline">{metric?.sourceId || "not connected"}</Badge>
        </div>
        <p className="break-words text-sm font-semibold [overflow-wrap:anywhere]">
          {metric?.label ?? metricId}
        </p>
        <p className="break-all font-mono text-xs text-muted-foreground">{metricId}</p>
      </div>
      <div className="min-w-0 space-y-2">
        <KpiTrendChart
          mode={mode}
          metric={
            metric ?? {
              metricId,
              label: metricId,
              axis: "",
              product: "",
              sourceId: "",
              status,
              current: null,
              target: null,
              targetHit: null,
              aggregation: "",
              cumulative: false,
              display: "",
              series: [],
            }
          }
        />
        {metric ? <MetricBreakdown metric={metric} /> : null}
      </div>
      <div className="min-w-0 space-y-2">
        {isDaily ? (
          <>
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Today</p>
            <Badge variant={diffBadgeVariant(todayDiff)} className="text-sm tabular-nums">
              {formatDailyDiff(todayDiff)}
            </Badge>
            <p className="text-xs text-muted-foreground">
              current {formatMetricValue(metric?.current ?? null)}
            </p>
          </>
        ) : isAvailable ? (
          <>
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Current</p>
            <p className="text-2xl font-semibold tabular-nums">
              {formatMetricValue(metric?.current ?? null)}
            </p>
            {progress !== null ? (
              <div className="space-y-1">
                <Progress value={progress} />
                <p className="text-xs text-muted-foreground">
                  {numberFormatter.format(progress)}% of {formatMetricValue(numericTarget)}
                </p>
              </div>
            ) : (
              <Badge variant="secondary">target not set</Badge>
            )}
            {stringTarget ? (
              <p className="break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
                target: {stringTarget}
              </p>
            ) : null}
          </>
        ) : (
          <p className="break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
            source gap: {gapReason ?? "not connected yet"}
          </p>
        )}
      </div>
    </div>
  );
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
                  <div key={goal.id} className="space-y-2 rounded-md border bg-muted/20 p-3">
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
                      <Badge variant="secondary">{goal.metrics.length} KPI(s)</Badge>
                    </div>
                    <Tabs defaultValue="daily" className="gap-3">
                      <TabsList className="h-8 rounded-md">
                        <TabsTrigger value="daily" className="text-xs">
                          Daily
                        </TabsTrigger>
                        <TabsTrigger value="cumulative" className="text-xs">
                          Cumulative
                        </TabsTrigger>
                      </TabsList>
                      {(["daily", "cumulative"] as const).map((mode) => (
                        <TabsContent key={mode} value={mode} className="m-0 space-y-2">
                          {goal.metrics.length > 0 ? (
                            goal.metrics.map((entry) => (
                              <KpiRow
                                key={`${goal.id}:${mode}:${entry.metricId}`}
                                metricId={entry.metricId}
                                metric={entry.metric}
                                gapReason={entry.gap?.reason ?? null}
                                mode={mode}
                              />
                            ))
                          ) : (
                            <p className="rounded-md border bg-background/40 p-3 text-sm text-muted-foreground">
                              No KPI IDs are attached to this SMART goal yet.
                            </p>
                          )}
                        </TabsContent>
                      ))}
                    </Tabs>
                    {goal.updateHint ? (
                      <p className="break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
                        Update: {goal.updateHint}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ))
        ) : (
          <p className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
            No goal axes found in farplane/goals.md.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
