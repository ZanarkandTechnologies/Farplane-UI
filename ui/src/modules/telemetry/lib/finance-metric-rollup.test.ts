import { describe, expect, it } from "vitest";
import { buildGlobalFinanceRollup, type FinanceProjectConfig } from "./finance-metric-rollup";

function config(input: {
  projectId: string;
  definitions: Record<string, unknown>;
  series?: unknown[];
  isGlobal?: boolean;
  finance?: Record<string, unknown>;
}): FinanceProjectConfig {
  return {
    projectId: input.projectId,
    projectName: input.projectId,
    isGlobal: input.isGlobal,
    config: {
      files: [
        {
          path: "farplane/metrics.yaml",
          parsedJson: { finance: input.finance, metrics: input.definitions },
        },
      ],
      runtimeSources: [
        {
          id: "project-ui",
          parsedJson: { metrics: { series: input.series ?? [] } },
        },
      ],
    },
  };
}

function metric(metricId: string, series: Array<{ date: string; value: number }>): unknown {
  return { metric_id: metricId, series };
}

describe("finance metric roll-up", () => {
  it("discovers finance metrics by metadata and sums current-month daily observations", () => {
    const rollup = buildGlobalFinanceRollup(
      [
        config({
          projectId: "global",
          isGlobal: true,
          finance: {
            currency: "USD",
            expense_limit: { amount: 400, window: "calendar_month" },
          },
          definitions: {},
        }),
        config({
          projectId: "alpha",
          definitions: {
            model_cost: { unit: "usd", finance: { flow: "expense", basis: "actual" } },
            sales: { unit: "usd", finance: { flow: "income", basis: "actual" } },
          },
          series: [
            metric("model_cost", [
              { date: "2026-07-01", value: 12.5 },
              { date: "2026-07-02", value: 7.5 },
              { date: "2026-06-30", value: 99 },
            ]),
            metric("sales", [{ date: "2026-07-02", value: 30 }]),
          ],
        }),
      ],
      new Date("2026-07-19T00:00:00Z"),
    );

    expect(rollup).toMatchObject({
      currency: "USD",
      expenseLimit: 400,
      actualExpense: 20,
      actualIncome: 30,
      actualNetCashFlow: 10,
      remainingExpenseBudget: 380,
      configuredMetricCount: 2,
      observedMetricCount: 2,
      observedActualMetricCount: 2,
      observedActualExpenseMetricCount: 1,
      configuredProjectCount: 1,
      reportingProjectCount: 1,
      unavailableProjectCount: 0,
    });
  });

  it("keeps estimated values separate and ignores unlabeled or mixed-currency metrics", () => {
    const rollup = buildGlobalFinanceRollup(
      [
        config({
          projectId: "global",
          isGlobal: true,
          finance: { currency: "USD" },
          definitions: {},
        }),
        config({
          projectId: "alpha",
          definitions: {
            savings: { unit: "usd", finance: { flow: "income", basis: "estimated" } },
            eur_cost: { unit: "eur", finance: { flow: "expense", basis: "actual" } },
            ordinary_metric: { unit: "usd" },
          },
          series: [
            metric("savings", [{ date: "2026-07-03", value: 45 }]),
            metric("eur_cost", [{ date: "2026-07-03", value: 8 }]),
            metric("ordinary_metric", [{ date: "2026-07-03", value: 100 }]),
          ],
        }),
      ],
      new Date("2026-07-19T00:00:00Z"),
    );

    expect(rollup.actualExpense).toBe(0);
    expect(rollup.actualIncome).toBe(0);
    expect(rollup.actualNetCashFlow).toBe(0);
    expect(rollup.observedActualMetricCount).toBe(0);
    expect(rollup.estimatedIncome).toBe(45);
    expect(rollup.observedActualExpenseMetricCount).toBe(0);
    expect(rollup.configuredMetricCount).toBe(1);
  });

  it("uses the latest value when a date appears more than once", () => {
    const rollup = buildGlobalFinanceRollup(
      [
        config({
          projectId: "global",
          isGlobal: true,
          finance: { currency: "USD" },
          definitions: {},
        }),
        config({
          projectId: "alpha",
          definitions: {
            spend: { unit: "usd", finance: { flow: "expense", basis: "actual" } },
          },
          series: [
            metric("spend", [
              { date: "2026-07-04", value: 4 },
              { date: "2026-07-04", value: 6 },
            ]),
          ],
        }),
      ],
      new Date("2026-07-19T00:00:00Z"),
    );

    expect(rollup.actualExpense).toBe(6);
    expect(rollup.actualNetCashFlow).toBe(-6);
  });

  it("uses the operator's local calendar month", () => {
    const now = new Date(2026, 7, 1, 0, 30);
    const rollup = buildGlobalFinanceRollup(
      [
        config({
          projectId: "global",
          isGlobal: true,
          finance: { currency: "USD" },
          definitions: {
            spend: { unit: "usd", finance: { flow: "expense", basis: "actual" } },
          },
          series: [metric("spend", [{ date: "2026-08-01", value: 9 }])],
        }),
      ],
      now,
    );

    expect(rollup.monthKey).toBe("2026-08");
    expect(rollup.actualExpense).toBe(9);
  });
});
