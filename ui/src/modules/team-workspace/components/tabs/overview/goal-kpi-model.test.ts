import { describe, expect, it } from "vitest";
import {
  buildGoalAxisViews,
  parseGoalAxesFromGoalsMarkdown,
  parseMetricsUiSnapshot,
} from "./goal-kpi-model";

const goalsMarkdown = `## Goals

\`\`\`yaml
goals:
  distribution_from_evidence:
    question: Can Farplane turn real harness evidence into audience?
    evidence_hints:
      - qualified attention
      - serious conversations
    smart_goals:
      - id: evidence_distribution_q3
        target: 100000 evidence-backed content views by 2026-09-30
        kpis:
          - x_followers
          - x_views
          - x_retention_score
        update_hint: >
          Use social metrics and record source gaps.
\`\`\``;

describe("goal KPI model", () => {
  it("parses goal axes, SMART goals, and KPI membership from fenced YAML", () => {
    const axes = parseGoalAxesFromGoalsMarkdown(goalsMarkdown);
    expect(axes).toHaveLength(1);
    expect(axes[0].id).toBe("distribution_from_evidence");
    expect(axes[0].smartGoals[0].kpis).toEqual(["x_followers", "x_views", "x_retention_score"]);
  });

  it("joins goal KPI IDs with metric readings and source gaps", () => {
    const axes = parseGoalAxesFromGoalsMarkdown(goalsMarkdown);
    const snapshot = parseMetricsUiSnapshot({
      snapshot_date: "2026-07-01",
      generated_at: "2026-07-01T00:00:00Z",
      metrics: [
        {
          metric_id: "x_followers",
          label: "X followers",
          axis: "distribution_from_evidence",
          source_id: "x_account_metrics",
          status: "available",
          current: 265,
          series: [{ date: "2026-07-01", value: 265, current: 265, daily_diff: null }],
        },
        {
          metric_id: "x_retention_score",
          label: "X retention score",
          axis: "distribution_from_evidence",
          source_id: "x_account_metrics",
          status: "source_gap",
          current: null,
          series: [],
        },
      ],
      source_gaps: [
        {
          metric_id: "x_retention_score",
          source_id: "x_account_metrics",
          reason: "no available observation for metric",
        },
      ],
    });
    const views = buildGoalAxisViews(axes, snapshot);
    expect(views[0].smartGoals[0].metrics[0].metric?.current).toBe(265);
    expect(views[0].smartGoals[0].metrics[2].gap?.reason).toBe(
      "no available observation for metric",
    );
  });
});
