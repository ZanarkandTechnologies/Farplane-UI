import { describe, expect, it } from "vitest";
import type { KpiMetricRow } from "../../lib/dashboard-projections/goal-kpi-model";
import { buildRollingSevenDayChartData, trendLabel } from "./goal-kpi-cockpit-model";

function metric(series: KpiMetricRow["series"]): KpiMetricRow {
  return {
    metricId: "x_views",
    label: "X views",
    axis: "distribution_from_evidence",
    product: "distribution",
    sourceId: "x_account_metrics",
    status: "available",
    current: series.at(-1)?.value ?? null,
    currentStatus: "available",
    type: "flow",
    windowStart: "2026-06-25",
    windowEnd: "2026-07-01",
    windowTimezone: "UTC",
    previousValue: 8,
    absoluteDelta: 7,
    percentDelta: 87.5,
    progressDelta: 7,
    momentum: "improving",
    cumulativeValue: 25,
    cumulativeThrough: "2026-07-01",
    cumulativeStatus: "available",
    target: null,
    targetHit: null,
    display: "reading",
    series,
  };
}

describe("goal KPI cockpit charts", () => {
  it("builds a calendar-aligned rolling 7-day window without inventing zeroes", () => {
    const data = buildRollingSevenDayChartData(
      metric([
        { date: "2026-06-29", value: 10, items: [] },
        { date: "2026-07-01", value: 15, items: [] },
      ]),
    );

    expect(data).toHaveLength(7);
    expect(data[0].date).toBe("2026-06-25");
    expect(data[4]).toMatchObject({ date: "2026-06-29", value: 10, cumulative: 10 });
    expect(data[5]).toMatchObject({ date: "2026-06-30", value: null, cumulative: 10 });
    expect(data[6]).toMatchObject({ date: "2026-07-01", value: 15, cumulative: 25 });
  });

  it("uses the Core-projected window comparison instead of deriving adjacent diffs", () => {
    const row = metric([
      { date: "2026-06-29", value: 0.2, items: [] },
      { date: "2026-07-01", value: 0.3, items: [] },
    ]);
    const data = buildRollingSevenDayChartData(row);

    expect(trendLabel(row)).toBe("improving +7");
    expect(data[6]).toMatchObject({ date: "2026-07-01", value: 0.3 });
  });

  it("anchors a flow chart to observations before the visible seven-day window", () => {
    const data = buildRollingSevenDayChartData(
      metric([
        { date: "2026-06-01", value: 5, items: [] },
        { date: "2026-06-29", value: 10, items: [] },
        { date: "2026-07-01", value: 15, items: [] },
      ]),
    );

    expect(data[0].cumulative).toBe(5);
    expect(data[4].cumulative).toBe(15);
    expect(data[6].cumulative).toBe(30);
  });
});
