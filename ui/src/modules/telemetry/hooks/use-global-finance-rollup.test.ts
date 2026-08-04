import { describe, expect, it } from "vitest";
import { loadGlobalFinanceRollup, type ProjectConfigPayload } from "./use-global-finance-rollup";

function payload(projectPath: string, amount: number): ProjectConfigPayload {
  const currentMonthDate = `${new Date().toISOString().slice(0, 7)}-19`;
  return {
    ok: true,
    projectPath,
    files: [
      {
        path: "farplane/metrics.yaml",
        parsedJson: {
          finance: { currency: "USD", expense_limit: { amount: 400, window: "calendar_month" } },
          metrics: {
            spend: { unit: "usd", finance: { flow: "expense", basis: "actual" } },
          },
        },
      },
    ],
    runtimeSources: [
      {
        id: "project-ui",
        parsedJson: {
          metrics: {
            series: [{ metric_id: "spend", series: [{ date: currentMonthDate, value: amount }] }],
          },
        },
      },
    ],
  };
}

describe("global finance roll-up loading", () => {
  it("keeps failed registered projects visible as unavailable coverage", async () => {
    const reader = async (projectPath?: string): Promise<ProjectConfigPayload> => {
      if (!projectPath) return payload("/root", 5);
      if (projectPath === "/alpha") return payload(projectPath, 12);
      throw new Error("unavailable");
    };

    const rollup = await loadGlobalFinanceRollup(
      [
        ["/root", { id: "root", name: "Root", trackingContext: "/root" }],
        ["/alpha", { id: "alpha", name: "Alpha", trackingContext: "/alpha" }],
        ["/beta", { id: "beta", name: "Beta", trackingContext: "/beta" }],
      ],
      reader,
    );

    expect(rollup.actualExpense).toBe(17);
    expect(rollup.configuredProjectCount).toBe(2);
    expect(rollup.unavailableProjectCount).toBe(1);
  });
});
