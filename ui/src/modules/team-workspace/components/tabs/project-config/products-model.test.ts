import { describe, expect, it } from "vitest";
import type { KpiMetricRow } from "@/modules/team-workspace/lib/dashboard-projections/goal-kpi-model";
import { groupMetricsByProduct, productRegistryFromProductsJson } from "./products-model";

function metric(metricId: string, product = ""): KpiMetricRow {
  return {
    aggregation: "latest",
    axis: "",
    cumulative: false,
    current: 1,
    display: "1",
    label: metricId,
    metricId,
    product,
    series: [],
    sourceId: "",
    status: "available",
    target: null,
    targetHit: null,
  };
}

describe("products model", () => {
  it("parses products-json-only migrated projects and goal-product matrix rows", () => {
    const registry = productRegistryFromProductsJson({
      kind: "project-products-index",
      lanes: [
        {
          id: "metric_experiments",
          default_weight: 30,
          purpose: "improve measured harness behavior",
        },
      ],
      products: [
        {
          id: "experiments",
          label: "Experiment reports",
          lane: "metric_experiments",
          audience: "builders",
          output: "baseline, variant, measurement, decision",
          reward: "validated improvement or rejected hypothesis",
          owner_skill: "farplane-experiment-report",
          status: "active",
          refs: { product: "farplane/products/experiments/product.md" },
          kpis: {
            primary: ["accepted_evidence_cycles"],
            supporting: ["interesting_autonomy_results"],
            guardrail: ["rejected_ai_ticket_count"],
          },
          goals: [
            {
              id: "accepted_evidence_cycle_loop",
              target: "Turn claims into evidence cycles.",
              kpis: ["accepted_evidence_cycles"],
              scope: "product",
            },
          ],
          artifact_workflows: [
            {
              id: "experiment_report",
              lane: "metric_experiments",
              owner: "farplane-experiment-report",
              planning_artifact: "experiment decision angle",
              execution_artifact: "experiment report draft",
              feedback_question: "accept / revise / reject",
            },
          ],
        },
      ],
      goal_product_matrix: [
        {
          axis_id: "validated_self_improvement",
          goal_id: "autonomous_improvement_q3",
          product_id: "experiments",
          product_label: "Experiment reports",
          product_goal_ids: ["accepted_evidence_cycle_loop"],
          shared_kpis: ["accepted_evidence_cycles"],
          shared_product_goal_kpis: ["accepted_evidence_cycles"],
          status: "aligned",
          target: "20 accepted harness improvements",
        },
      ],
    });

    expect(registry?.products[0]).toMatchObject({
      lanePurpose: "improve measured harness behavior",
      laneWeight: 30,
      productId: "experiments",
      sourcePath: "farplane/products/experiments/product.md",
      kpis: {
        all: [
          "accepted_evidence_cycles",
          "interesting_autonomy_results",
          "rejected_ai_ticket_count",
        ],
      },
    });
    expect(registry?.products[0].goals[0].id).toBe("accepted_evidence_cycle_loop");
    expect(registry?.products[0].artifactWorkflows[0].executionArtifact).toBe(
      "experiment report draft",
    );
    expect(registry?.goalProductMatrix[0]).toMatchObject({
      goalId: "autonomous_improvement_q3",
      productId: "experiments",
      sharedKpis: ["accepted_evidence_cycles"],
      status: "aligned",
    });
  });

  it("groups metrics by explicit product and registry KPI membership without regex assumptions", () => {
    const registry = productRegistryFromProductsJson({
      kind: "project-products-index",
      products: [
        {
          id: "market_learning",
          kpis: { primary: ["decision_changing_learning_briefs"] },
        },
      ],
    });

    const grouped = groupMetricsByProduct(
      [
        metric("decision_changing_learning_briefs"),
        metric("latest_eval_pass_rate", "productization"),
      ],
      registry?.products ?? [],
    );

    expect(grouped.get("market_learning")?.map((row) => row.metricId)).toEqual([
      "decision_changing_learning_briefs",
    ]);
    expect(grouped.get("productization")?.map((row) => row.metricId)).toEqual([
      "latest_eval_pass_rate",
    ]);
  });
});
