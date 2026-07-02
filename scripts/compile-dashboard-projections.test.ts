import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { parseMetricsUiSnapshot } from "../ui/src/modules/team-workspace/lib/dashboard-projections/goal-kpi-model";
import { parseOverviewSurface } from "../ui/src/modules/team-workspace/lib/dashboard-projections/overview-surface";

const execFileAsync = promisify(execFile);

describe("dashboard projection compiler", () => {
  it("writes parser-compatible metric and overview projections", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "farplane-dashboard-projection-"));
    await mkdir(path.join(root, "farplane"), { recursive: true });
    await mkdir(path.join(root, ".farplane/metrics/provider-exports"), { recursive: true });
    await mkdir(path.join(root, ".farplane/reports/interval/daily_interval"), { recursive: true });
    await writeFile(
      path.join(root, "farplane/goals.md"),
      [
        "# Goals",
        "",
        "```yaml",
        "goals:",
        "  distribution:",
        "    smart_goals:",
        "      - id: distribution",
        "        kpis:",
        "          - x_views",
        "          - instagram_retention_score",
        "```",
      ].join("\n"),
    );
    await writeFile(
      path.join(root, ".farplane/metrics/provider-exports/x_latest_selected.json"),
      JSON.stringify({
        content_items: [
          {
            platform: "x",
            content_id: "post-1",
            kind: "post",
            content_metrics: { views: 125, engagements: 12 },
          },
        ],
      }),
    );
    await writeFile(
      path.join(root, ".farplane/reports/interval/daily_interval/report.md"),
      [
        "---",
        "created_at: 2026-07-02T05:36:11+08:00",
        "summary: >",
        "  decision: Treat the metric/KPI source-gap push as partially rewarded and",
        "  shift the next 24h to frontier refresh.",
        "---",
        "",
        "# Daily report",
        "",
        "## Summary",
        "",
        "- Body decision row should not replace frontmatter.",
        "- Body why-now row should not render as another card section.",
      ].join("\n"),
    );

    await execFileAsync("node", [
      "scripts/compile-dashboard-projections.mjs",
      "--project",
      root,
      "--json",
    ]);

    const metrics = parseMetricsUiSnapshot(
      JSON.parse(await readFile(path.join(root, ".farplane/metrics/ui/latest.json"), "utf-8")),
    );
    const overview = parseOverviewSurface(
      JSON.parse(await readFile(path.join(root, ".farplane/state/overview_surface.json"), "utf-8")),
    );

    expect(metrics?.metrics.find((metric) => metric.metricId === "x_views")?.current).toBe(125);
    expect(metrics?.sourceGaps.some((gap) => gap.metricId === "instagram_retention_score")).toBe(
      true,
    );
    expect(overview?.pins).toHaveLength(4);
    expect(overview?.attention.some((item) => item.title === "instagram_retention_score")).toBe(
      true,
    );
    expect(overview?.reports[0].label).toBe("daily_interval/report.md");
    expect(overview?.reports[0].summaryRows).toEqual([
      "decision: Treat the metric/KPI source-gap push as partially rewarded and shift the next 24h to frontier refresh.",
    ]);
    expect(overview?.reports[0].content).not.toContain("created_at:");
  });
});
