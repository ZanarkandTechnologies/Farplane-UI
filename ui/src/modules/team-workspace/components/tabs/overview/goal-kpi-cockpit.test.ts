import { describe, expect, it } from "vitest";
import { buildRollingSevenDayChartData } from "./goal-kpi-cockpit";
import type { KpiMetricRow } from "./goal-kpi-model";

function metric(series: KpiMetricRow["series"]): KpiMetricRow {
  return {
    metricId: "x_views",
    label: "X views",
    axis: "distribution_from_evidence",
    sourceId: "x_account_metrics",
    status: "available",
    current: series.at(-1)?.current ?? null,
    target: null,
    targetHit: null,
    aggregation: "point",
    cumulative: false,
    display: "reading",
    series,
  };
}

describe("goal KPI cockpit charts", () => {
  it("builds a calendar-aligned rolling 7-day window without inventing zeroes", () => {
    const data = buildRollingSevenDayChartData(
      metric([
        { date: "2026-06-29", value: 10, current: 10, dailyDiff: null, items: [] },
        { date: "2026-07-01", value: 15, current: 15, dailyDiff: 5, items: [] },
      ]),
    );

    expect(data).toHaveLength(7);
    expect(data[0].date).toBe("2026-06-25");
    expect(data[4]).toMatchObject({ date: "2026-06-29", current: 10, dailyDiff: null });
    expect(data[5]).toMatchObject({ date: "2026-06-30", current: null, dailyDiff: null });
    expect(data[6]).toMatchObject({ date: "2026-07-01", current: 15, dailyDiff: 5 });
  });
});
