/**
 * Pure Goal KPI cockpit helpers.
 * Inputs are projected KPI metric rows; outputs are formatted values, rolling
 * chart points, and state labels for the React cockpit component.
 */

import type { KpiMetricRow } from "../../lib/dashboard-projections/goal-kpi-model";

const numberFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

export type KpiChartPoint = {
  date: string;
  label: string;
  current: number | null;
  dailyDiff: number | null;
};

export function formatMetricValue(value: number | null): string {
  return typeof value === "number" && Number.isFinite(value) ? numberFormatter.format(value) : "-";
}

function computedDailyDiff(
  point: { current: number | null; dailyDiff: number | null },
  previous: { current: number | null } | null,
): number | null {
  if (typeof point.dailyDiff === "number") return point.dailyDiff;
  if (typeof point.current === "number" && typeof previous?.current === "number") {
    return point.current - previous.current;
  }
  return null;
}

function formatShortDate(date: Date): string {
  return `${date.getUTCMonth() + 1}/${date.getUTCDate()}`;
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function sortedMetricPoints(metric: KpiMetricRow | null): Array<
  KpiMetricRow["series"][number] & { parsedDate: Date }
> {
  return (metric?.series ?? [])
    .map((point) => ({
      ...point,
      parsedDate: new Date(`${point.date}T00:00:00Z`),
    }))
    .filter((point) => !Number.isNaN(point.parsedDate.getTime()))
    .sort((left, right) => left.parsedDate.getTime() - right.parsedDate.getTime());
}

export function latestDailyDiff(metric: KpiMetricRow | null): number | null {
  const datedPoints = sortedMetricPoints(metric);
  const latest = datedPoints.at(-1);
  if (!latest) return null;
  return computedDailyDiff(latest, datedPoints.at(-2) ?? null);
}

export function buildRollingSevenDayChartData(metric: KpiMetricRow): KpiChartPoint[] {
  const datedPoints = sortedMetricPoints(metric);
  const latestDate = datedPoints.at(-1)?.parsedDate;
  if (!latestDate) return [];
  const pointByDate = new Map(datedPoints.map((point) => [point.date, point]));
  const firstDate = addUtcDays(latestDate, -6);
  return Array.from({ length: 7 }, (_, index) => {
    const date = addUtcDays(firstDate, index);
    const key = date.toISOString().slice(0, 10);
    const point = pointByDate.get(key);
    const previous = point ? datedPoints[datedPoints.indexOf(point) - 1] ?? null : null;
    return {
      date: key,
      label: formatShortDate(date),
      current: point?.current ?? null,
      dailyDiff: point ? computedDailyDiff(point, previous) : null,
    };
  });
}

export function metricTargetHit(metric: KpiMetricRow | null): boolean {
  if (!metric) return false;
  if (metric.targetHit === true) return true;
  if (typeof metric.target !== "number" || metric.current === null) return false;
  if (metric.targetDirection === "below") return metric.current <= metric.target;
  if (metric.targetDirection === "equals") return metric.current === metric.target;
  return metric.current >= metric.target;
}

export function targetCopy(metric: KpiMetricRow | null): string {
  const numericTarget = typeof metric?.target === "number" ? metric.target : null;
  const stringTarget = typeof metric?.target === "string" ? metric.target : null;
  const targetValue = numericTarget !== null ? formatMetricValue(numericTarget) : stringTarget;
  if (!targetValue) return "";
  return [
    metric?.targetDirection,
    targetValue,
    metric?.targetUnit,
    metric?.targetDeadline ? `by ${metric.targetDeadline}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function trendLabel(metric: KpiMetricRow | null): string {
  if (!metric || metric.series.length === 0) return "no trend";
  const diff = latestDailyDiff(metric);
  if (diff === null) return "latest";
  if (diff > 0) return `+${numberFormatter.format(diff)}`;
  return numberFormatter.format(diff);
}

export function metricStateLabel(status: string): string {
  if (status === "available") return "OK";
  if (status === "source_gap" || status === "missing") return "Gap";
  return status;
}

export function metricRowState(
  metric: KpiMetricRow | null,
  status: string,
): "hit" | "gap" | "active" {
  if (metricTargetHit(metric)) return "hit";
  if (status === "source_gap" || status === "missing") return "gap";
  return "active";
}
