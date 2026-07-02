/**
 * Product tab KPI model helpers.
 * Maps compiled KPI rows back to product surfaces and formats numeric evidence.
 */

import type { KpiMetricRow } from "@/modules/team-workspace/lib/dashboard-projections/goal-kpi-model";

const numberFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

export function groupMetricsByProduct(metrics: KpiMetricRow[]): Map<string, KpiMetricRow[]> {
  const grouped = new Map<string, KpiMetricRow[]>();
  for (const metric of metrics) {
    const key = metric.product || productFromMetricId(metric.metricId);
    if (!key) continue;
    grouped.set(key, [...(grouped.get(key) ?? []), metric]);
  }
  return grouped;
}

function productFromMetricId(metricId: string): string {
  if (/accepted_evidence_cycles/i.test(metricId)) return "experiments";
  if (/accepted_harness_improvements|latest_eval_pass_rate/i.test(metricId)) return "productization";
  if (/distribution|instagram|x_|posts_published|github_views/i.test(metricId)) return "distribution";
  return "";
}

export function formatMetricValue(value: number | null): string {
  return typeof value === "number" && Number.isFinite(value) ? numberFormatter.format(value) : "-";
}
