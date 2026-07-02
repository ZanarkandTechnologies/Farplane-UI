import { describe, expect, it } from "vitest";
import type { OverviewReportLink } from "@/modules/team-workspace/lib/dashboard-projections/overview-surface";
import { reportSummaryRows } from "./overview-report-model";

function report(overrides: Partial<OverviewReportLink>): OverviewReportLink {
  return {
    id: "daily",
    label: "Daily report",
    path: ".farplane/reports/interval/daily_interval/report.md",
    updatedAtMs: null,
    ...overrides,
  };
}

describe("overview report model", () => {
  it("keeps a frontmatter summary as one paragraph row", () => {
    expect(
      reportSummaryRows(
        report({
          summary:
            "decision: Treat the metric/KPI source-gap push as partially rewarded and shift the next 24h to frontier refresh.\nwhy_now: Pulse is no longer blocked by missing KPI mechanics.",
        }),
      ),
    ).toEqual([
      "decision: Treat the metric/KPI source-gap push as partially rewarded and shift the next 24h to frontier refresh.\nwhy_now: Pulse is no longer blocked by missing KPI mechanics.",
    ]);
  });

  it("honors projection-provided rows when they are already normalized", () => {
    expect(
      reportSummaryRows(
        report({
          summary: "Fallback summary",
          summaryRows: ["Projected summary paragraph."],
        }),
      ),
    ).toEqual(["Projected summary paragraph."]);
  });
});
