import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { FarplaneProjectConfig } from "./config-types";
import { ProjectObjectivesTab } from "./project-contract-tabs";

function config(): FarplaneProjectConfig {
  return {
    ok: true,
    projectPath: "/tmp/farplane-ui",
    generatedAtMs: Date.parse("2026-07-26T00:00:00Z"),
    files: [],
    runtimeSources: [
      {
        id: "project-ui",
        label: "Project UI",
        path: ".farplane/project/ui/latest.json",
        kind: "file",
        absolutePath: "/tmp/farplane-ui/.farplane/project/ui/latest.json",
        exists: true,
        updatedAtMs: Date.parse("2026-07-26T00:00:00Z"),
        childCount: null,
        parsedJson: {
          generated_at: "2026-07-26T00:00:00Z",
          schema_version: 3,
          source_gaps: [],
          metrics: {
            contents: [],
            primitives: {},
            readings: {},
            definitions: {
              revenue: {
                metric_id: "revenue",
                label: "Revenue",
                type: "flow",
                unit: "usd",
                direction: "maximize",
              },
            },
            series: [],
          },
          tabs: {
            overview: { charter: {}, pinned_metrics: [], pinned_metric_cards: [] },
            objectives: {
              selection: { objectives: [{ metric_id: "revenue", priority: 1 }], guards: [] },
              metric_cards: [
                {
                  metric_id: "revenue",
                  label: "Revenue",
                  type: "flow",
                  unit: "usd",
                  direction: "maximize",
                  status: "available",
                  current: { value: 5, observed_at: "2026-07-26", status: "available" },
                  window: { start: "2026-07-20", end: "2026-07-26", timezone: "UTC" },
                  comparison: {
                    previous_start: "2026-07-13",
                    previous_end: "2026-07-19",
                    previous_value: 2,
                    absolute_delta: 3,
                    percent_delta: 150,
                    progress_delta: 3,
                    momentum: "improving",
                    reason: null,
                  },
                  cumulative: { value: 7, through: "2026-07-26", status: "available" },
                  series: [
                    { date: "2026-07-19", value: 2 },
                    { date: "2026-07-26", value: 5 },
                  ],
                  source_gaps: [],
                  source_gap_ids: [],
                },
              ],
              source_gap_ids: [],
            },
            cadence: { automations: [], source_gap_ids: [] },
            distribution: {
              content_items: [],
              content_metric_cards: [],
              content_metric_ids: [],
              source_gap_ids: [],
            },
          },
        },
      },
    ],
  };
}

describe("project objectives metric projection", () => {
  it("renders Core-owned current, comparison, cumulative, and raw observation views", () => {
    const markup = renderToStaticMarkup(
      createElement(ProjectObjectivesTab, {
        config: config(),
        error: null,
        state: "ready",
      }),
    );

    expect(markup).toContain("5 usd");
    expect(markup).toContain("improving · +3 usd");
    expect(markup).toContain("previous 2");
    expect(markup).toContain("7 usd");
    expect(markup).toContain("2 raw observations");
  });
});
