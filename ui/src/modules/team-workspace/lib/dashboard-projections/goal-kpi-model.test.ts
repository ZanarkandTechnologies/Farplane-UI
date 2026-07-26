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
          - id: x_followers
            target: 1000
            direction: above
          - id: x_views
            target: 100000
            direction: above
          - id: x_retention_score
            target: 0.4
            direction: above
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
      schema_version: 3,
      snapshot_date: "2026-07-01",
      generated_at: "2026-07-01T00:00:00Z",
      metrics: [
        {
          metric_id: "x_followers",
          label: "X followers",
          description: "Latest follower count from the X account export.",
          axis: "distribution_from_evidence",
          source_id: "x_account_metrics",
          status: "available",
          type: "stock",
          current: { value: 265, observed_at: "2026-07-01", status: "available" },
          window: { start: "2026-06-25", end: "2026-07-01", timezone: "UTC" },
          comparison: {
            previous_value: 250,
            absolute_delta: 15,
            percent_delta: 6,
            progress_delta: 15,
            momentum: "improving",
          },
          cumulative: null,
          series: [{ date: "2026-07-01", value: 265 }],
        },
        {
          metric_id: "x_retention_score",
          label: "X retention score",
          axis: "distribution_from_evidence",
          source_id: "x_account_metrics",
          status: "source_gap",
          type: "stock",
          current: { value: null, observed_at: null, status: "source_gap" },
          window: { start: "2026-06-25", end: "2026-07-01", timezone: "UTC" },
          comparison: {
            previous_value: null,
            absolute_delta: null,
            percent_delta: null,
            progress_delta: null,
            momentum: "unknown",
          },
          cumulative: null,
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
    expect(views[0].smartGoals[0].metrics[0].metric?.description).toBe(
      "Latest follower count from the X account export.",
    );
    expect(views[0].smartGoals[0].metrics[2].gap?.reason).toBe(
      "no available observation for metric",
    );
  });

  it("parses schema v3 metric projections, content rows, and per-metric source gaps", () => {
    const snapshot = parseMetricsUiSnapshot({
      schema_version: 3,
      snapshot_date: "2026-07-02",
      metrics: [
        {
          metric_id: "instagram_likes",
          label: "Instagram likes",
          product: "distribution",
          unit: "likes",
          type: "flow",
          current: { value: 133, observed_at: "2026-07-01", status: "available" },
          window: { start: "2026-06-25", end: "2026-07-01", timezone: "UTC" },
          comparison: {
            previous_value: 100,
            absolute_delta: 33,
            percent_delta: 33,
            progress_delta: 33,
            momentum: "improving",
          },
          cumulative: { value: 300, through: "2026-07-01", status: "available" },
          series: [{ date: "2026-07-01", value: 133 }],
          source_gaps: ["instagram export missing retention"],
        },
      ],
      contents: [
        {
          content_id: "instagram:17966345906934171",
          external_id: "17966345906934171",
          id: "instagram:17966345906934171",
          kind: "reels",
          media_product_type: "REELS",
          media_type: "VIDEO",
          url: "https://www.instagram.com/p/DaIvpaOmQhj/",
          metrics: [
            {
              metric_id: "instagram_likes",
              label: "Instagram likes",
              unit: "likes",
              product: "distribution",
              current: 133,
              series: [{ date: "2026-07-01", value: 133 }],
            },
          ],
        },
      ],
    });

    expect(snapshot?.schemaVersion).toBe(3);
    expect(snapshot?.metrics[0].series[0].value).toBe(133);
    expect(snapshot?.metrics[0].absoluteDelta).toBe(33);
    expect(snapshot?.metrics[0].cumulativeValue).toBe(300);
    expect(snapshot?.sourceGaps[0].reason).toBe("instagram export missing retention");
    expect(snapshot?.contents[0].contentId).toBe("instagram:17966345906934171");
    expect(snapshot?.contents[0].externalId).toBe("17966345906934171");
    expect(snapshot?.contents[0].kind).toBe("reels");
    expect(snapshot?.contents[0].mediaProductType).toBe("REELS");
    expect(snapshot?.contents[0].mediaType).toBe("VIDEO");
    expect(snapshot?.contents[0].metrics[0].current).toBe(133);
  });
});
