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
          work_lanes: [
            { lane_id: "trust_distribution", default_weight: 15, purpose: "ship proof" },
          ],
          products: [
            {
              product_id: "viral_agent_office",
              name: "Viral agent-office experience",
              audience: "builders",
              artifact_workflows: [
                {
                  execution_artifact: "demo cut",
                  feedback_question: "publish?",
                  id: "demo_video",
                  lane: "trust_distribution",
                  owner: "farplane-evidence-content",
                  planning_artifact: "content angle",
                },
              ],
              goals: [
                {
                  id: "distribution_loop",
                  interpretation: "Ship more proof when content changes decisions.",
                  kpis: ["x_views"],
                  scope: "product",
                  target: "Turn evidence into public attention.",
                },
              ],
              kpis: {
                all: ["x_views", "rejected_ai_ticket_count"],
                guardrail: ["rejected_ai_ticket_count"],
                primary: ["x_views"],
                supporting: [],
              },
              lane: "trust_distribution",
              output: "demos",
              owner_skill: "farplane-evidence-content",
              reward: "curiosity",
              kpi_ids: ["x_views"],
              metric_ids: ["x_views"],
              proof_state: "source_gap",
              ticket_count: 2,
              source_gap_ids: ["missing_content_ledger"],
              source_ref: {
                path: "farplane/products/viral_agent_office/product.md",
                row_id: "viral_agent_office",
              },
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
    expect(snapshot?.tabs.products.products[0]).toMatchObject({
      lane: "trust_distribution",
      laneWeight: null,
      ownerSkill: "farplane-evidence-content",
      kpis: { primary: ["x_views"], guardrail: ["rejected_ai_ticket_count"] },
      sourceRef: { path: "farplane/products/viral_agent_office/product.md" },
    });
    expect(snapshot?.tabs.products.products[0].goals[0]).toMatchObject({
      id: "distribution_loop",
      scope: "product",
    });
    expect(snapshot?.tabs.products.products[0].artifactWorkflows[0]).toMatchObject({
      id: "demo_video",
      owner: "farplane-evidence-content",
      planningArtifact: "content angle",
    });
    expect(snapshot?.tabs.products.workLanes[0]).toMatchObject({
      laneId: "trust_distribution",
      defaultWeight: 15,
    });
    expect(sourceGapText(snapshot, ["missing_content_ledger"])[0].path).toBe(
      ".farplane/content/ledger.jsonl",
    );
  });

  it("preserves the product-loop portfolio shape emitted by products JSON snapshots", () => {
    const productIds = [
      "experiments",
      "ablations",
      "productization",
      "distribution",
      "market_learning",
    ];
    const snapshot = parseProjectUiSnapshot({
      generated_at: "2026-07-08T13:00:00Z",
      schema_version: 2,
      source_gaps: [],
      metrics: { contents: [], primitives: {}, readings: {}, series: [] },
      tabs: {
        overview: {
          pinned_metrics: [],
          pinned_metric_cards: [],
          source_gap_ids: [],
          team_focus: {},
        },
        goals: { axes: [], source_gap_ids: [] },
        products: {
          source_gap_ids: [],
          work_lanes: [
            {
              lane_id: "metric_experiments",
              default_weight: 30,
              purpose: "improve measured harness behavior",
            },
            {
              lane_id: "trust_ablations",
              default_weight: 20,
              purpose: "prove or reject trust claims",
            },
            { lane_id: "productization", default_weight: 20, purpose: "ship accepted wins" },
            {
              lane_id: "trust_distribution",
              default_weight: 15,
              purpose: "distribute proven evidence",
            },
            {
              lane_id: "market_learning",
              default_weight: 10,
              purpose: "sharpen user and pain understanding",
            },
          ],
          products: productIds.map((productId) => ({
            product_id: productId,
            name: productId.replace(/_/g, " "),
            lane:
              productId === "distribution"
                ? "trust_distribution"
                : productId === "experiments"
                  ? "metric_experiments"
                  : productId,
            owner_skill: `farplane-${productId}`,
            kpis: {
              all: [`${productId}_primary`, `${productId}_supporting`],
              guardrail: productId === "distribution" ? [] : ["rejected_ai_ticket_count"],
              primary: [`${productId}_primary`],
              supporting: [`${productId}_supporting`],
            },
            kpi_ids: [`${productId}_primary`],
            metric_ids: [`${productId}_primary`],
            goals: [
              {
                id: `${productId}_loop`,
                target: `Make ${productId} decision-bearing.`,
                kpis: [`${productId}_primary`],
                scope: "product",
              },
            ],
            artifact_workflows: [
              {
                id: `${productId}_workflow`,
                lane: productId,
                owner: `farplane-${productId}`,
                planning_artifact: "planning brief",
                execution_artifact: "execution artifact",
                feedback_question: "accept / revise / reject",
              },
            ],
            source_ref: { path: `farplane/products/${productId}/product.md`, row_id: productId },
          })),
        },
        distribution: {
          content_items: [],
          content_metric_cards: [],
          content_metric_ids: [],
          source_gap_ids: [],
        },
      },
    });

    expect(snapshot?.tabs.products.products.map((product) => product.productId)).toEqual(
      productIds,
    );
    expect(snapshot?.tabs.products.workLanes.map((lane) => lane.defaultWeight)).toEqual([
      30, 20, 20, 15, 10,
    ]);
    expect(
      snapshot?.tabs.products.products.find((product) => product.productId === "distribution"),
    ).toMatchObject({
      lane: "trust_distribution",
      ownerSkill: "farplane-distribution",
      sourceRef: { path: "farplane/products/distribution/product.md" },
      kpis: { primary: ["distribution_primary"] },
    });
    expect(
      snapshot?.tabs.products.products.find((product) => product.productId === "market_learning")
        ?.goals[0],
    ).toMatchObject({
      id: "market_learning_loop",
      target: "Make market_learning decision-bearing.",
    });
  });
});
