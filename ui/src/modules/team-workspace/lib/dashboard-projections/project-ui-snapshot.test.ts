import { describe, expect, it } from "vitest";
import { parseProjectUiSnapshot, sourceGapText } from "./project-ui-snapshot";

describe("project UI snapshot model", () => {
  it("parses unified snapshot tabs, metric cards, product rows, and source gaps", () => {
    const snapshot = parseProjectUiSnapshot({
      generated_at: "2026-07-03T00:00:00Z",
      schema_version: 1,
      project: { id: "farplane-ui", name: "Farplane UI" },
      sources: [{ id: "farplane:products.md", path: "farplane/products.md", status: "loaded" }],
      source_gaps: [
        {
          id: "missing_content_ledger",
          message: "missing_content_ledger",
          owner: "distribution",
          severity: "source_gap",
          source_ref: { path: ".farplane/content/ledger.jsonl" },
        },
      ],
      metrics: {
        primitives: { content_reach: { owner: "farplane-core" } },
        readings: {},
        series: [
          {
            metric_id: "x_views",
            label: "X Views",
            description: "Counts content views from approved evidence posts.",
            product_id: "viral_agent_office",
            primitive_id: "content_reach",
            status: "source_gap",
            current: null,
            target_spec: { direction: "above", value: 1000, unit: "views", deadline: "2026-07-31" },
            source_gap_ids: ["missing_content_ledger"],
            source_gaps: [
              {
                date: "2026-07-03",
                status: "source_gap",
                reason: "no_component_view_observations",
                payload: {
                  source_path: ".farplane/metrics/observations/content_views_total/2026-07-03.json",
                  missing_components: ["instagram_views", "x_views"],
                },
              },
            ],
            unit: "views",
            display: "n/a",
            pinned: true,
            series: [],
          },
        ],
        contents: [],
      },
      tabs: {
        overview: {
          pinned_metrics: ["x_views"],
          pinned_metric_cards: [],
          primitive_summary: {},
          source_gap_ids: ["missing_content_ledger"],
          team_focus: { active_product_ids: ["viral_agent_office"] },
        },
        goals: {
          axes: [
            {
              id: "distribution",
              label: "Distribution",
              question: "Can Farplane earn attention?",
              smart_goals: [
                {
                  id: "views",
                  target: "1000 views",
                  kpis: [
                    {
                      metric_id: "x_views",
                      label: "X Views",
                      tooltip: "Counts content views from approved evidence posts.",
                      primitive_id: "content_reach",
                      status: "source_gap",
                      current: null,
                      target: { direction: "above", value: 1000, unit: "views" },
                      source_gap_ids: ["missing_content_ledger"],
                      unit: "views",
                    },
                  ],
                },
              ],
            },
          ],
        },
        products: {
          products: [
            {
              product_id: "viral_agent_office",
              name: "Viral agent-office experience",
              audience: "builders",
              output: "demos",
              reward: "curiosity",
              kpi_ids: ["x_views"],
              metric_ids: ["x_views"],
              proof_state: "source_gap",
              ticket_count: 2,
              source_gap_ids: ["missing_content_ledger"],
            },
          ],
        },
        distribution: {
          content_items: [],
          content_metric_cards: [],
          content_metric_ids: ["x_views"],
          source_gap_ids: ["missing_content_ledger"],
        },
      },
    });

    expect(snapshot?.metrics.series[0].target).toMatchObject({ direction: "above" });
    expect(snapshot?.metrics.series[0].sourceGaps[0]).toMatchObject({
      reason: "no_component_view_observations",
      missingComponents: ["instagram_views", "x_views"],
    });
    expect(snapshot?.metrics.series[0].description).toBe(
      "Counts content views from approved evidence posts.",
    );
    expect(snapshot?.tabs.goals.axes[0].smartGoals[0].kpis[0].description).toBe(
      "Counts content views from approved evidence posts.",
    );
    expect(snapshot?.tabs.goals.axes[0].smartGoals[0].kpis[0].metricId).toBe("x_views");
    expect(snapshot?.tabs.products.products[0].ticketCount).toBe(2);
    expect(sourceGapText(snapshot, ["missing_content_ledger"])[0].path).toBe(
      ".farplane/content/ledger.jsonl",
    );
  });
});
