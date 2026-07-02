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

  it("parses schema v2 content rows and per-metric source gaps", () => {
    const snapshot = parseMetricsUiSnapshot({
      schema_version: 2,
      snapshot_date: "2026-07-02",
      metrics: [
        {
          metric_id: "instagram_likes",
          label: "Instagram likes",
          product: "distribution",
          unit: "likes",
          current: 133,
          series: [{ date: "2026-07-01", value: 133, cumulative: 133 }],
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

    expect(snapshot?.schemaVersion).toBe(2);
    expect(snapshot?.metrics[0].series[0].current).toBe(133);
    expect(snapshot?.sourceGaps[0].reason).toBe("instagram export missing retention");
    expect(snapshot?.contents[0].contentId).toBe("instagram:17966345906934171");
    expect(snapshot?.contents[0].externalId).toBe("17966345906934171");
    expect(snapshot?.contents[0].kind).toBe("reels");
    expect(snapshot?.contents[0].mediaProductType).toBe("REELS");
    expect(snapshot?.contents[0].mediaType).toBe("VIDEO");
    expect(snapshot?.contents[0].metrics[0].current).toBe(133);
  });
});
