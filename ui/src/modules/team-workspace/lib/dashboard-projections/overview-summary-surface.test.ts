import { describe, expect, it } from "vitest";
import type { FarplaneProjectConfig } from "@/modules/team-workspace/lib/project-config";
import { buildOverviewSummarySurface } from "./overview-summary-surface";

function projectConfigWithSnapshot(parsedJson: unknown): FarplaneProjectConfig {
  return {
    ok: true,
    projectPath: "/tmp/farplane",
    generatedAtMs: Date.UTC(2026, 6, 3),
    files: [],
    runtimeSources: [
      {
        id: "project-ui",
        label: "Project UI snapshot",
        path: ".farplane/project/ui/latest.json",
        kind: "file",
        absolutePath: "/tmp/farplane/.farplane/project/ui/latest.json",
        exists: true,
        updatedAtMs: Date.UTC(2026, 6, 3),
        childCount: null,
        parsedJson,
      },
    ],
  };
}

describe("overview summary surface", () => {
  it("uses pinned metric readings as values instead of display mode strings", () => {
    const surface = buildOverviewSummarySurface({
      aiBurn24hUsd: 0,
      projectConfig: projectConfigWithSnapshot({
        generated_at: "2026-07-03T00:00:00Z",
        schema_version: 1,
        source_gaps: [],
        metrics: {
          contents: [],
          primitives: {},
          readings: {},
          series: [
            {
              metric_id: "accepted_evidence_cycles",
              label: "Accepted evidence cycles",
              product_id: "experiments",
              primitive_id: "ticket_count_by_kpi",
              status: "available",
              current: 7,
              display: "bar_plus_cumulative",
              pinned: true,
              target: { direction: "above", value: 10, unit: "cycles" },
              target_hit: false,
              source_gap_ids: [],
              series: [{ date: "2026-07-03", current: 7, daily_diff: 2 }],
            },
          ],
        },
        tabs: {
          overview: {
            pinned_metrics: ["accepted_evidence_cycles"],
            pinned_metric_cards: [],
            source_gap_ids: [],
            team_focus: {},
          },
          goals: { axes: [], source_gap_ids: [] },
          products: { products: [], source_gap_ids: [] },
          distribution: {
            content_items: [],
            content_metric_cards: [],
            content_metric_ids: [],
            source_gap_ids: [],
          },
        },
      }),
    });

    expect(surface.pins[0]).toMatchObject({
      id: "accepted_evidence_cycles",
      value: "7",
      detail: "target above 10 cycles",
      provider: "ticket_count_by_kpi",
    });
  });

  it("renders pinned source-gap rollups as unavailable with component details", () => {
    const surface = buildOverviewSummarySurface({
      aiBurn24hUsd: 0,
      projectConfig: projectConfigWithSnapshot({
        generated_at: "2026-07-03T00:00:00Z",
        schema_version: 1,
        source_gaps: [
          {
            id: "metric_source_gap:evidence_distribution_reach",
            message: "no_component_view_observations",
            owner: "metrics",
            severity: "source_gap",
            source_ref: { path: "farplane/bindings.yaml" },
          },
        ],
        metrics: { contents: [], primitives: {}, readings: {}, series: [] },
        tabs: {
          overview: {
            pinned_metrics: ["evidence_distribution_reach"],
            pinned_metric_cards: [
              {
                metric_id: "evidence_distribution_reach",
                label: "Evidence distribution reach",
                status: "source_gap",
                current: null,
                description: "Pinned overview rollup of same-window platform view readings.",
                source_gaps: [
                  {
                    date: "2026-07-03",
                    status: "source_gap",
                    reason: "no_component_view_observations",
                    payload: {
                      missing_components: ["instagram_views", "x_views", "github_views"],
                      source_path:
                        ".farplane/metrics/observations/content_views_total/2026-07-03.json",
                    },
                  },
                ],
                series: [],
              },
            ],
            source_gap_ids: ["metric_source_gap:evidence_distribution_reach"],
            team_focus: {},
          },
          goals: { axes: [], source_gap_ids: [] },
          products: { products: [], source_gap_ids: [] },
          distribution: {
            content_items: [],
            content_metric_cards: [],
            content_metric_ids: [],
            source_gap_ids: [],
          },
        },
      }),
    });

    expect(surface.pins[0]).toMatchObject({
      id: "evidence_distribution_reach",
      value: "waiting",
      detail: "Needs same-day views from Instagram, X, and GitHub.",
      provider: "source gap",
      status: "source_gap",
      description: "Pinned overview rollup of same-window platform view readings.",
    });
  });
});
