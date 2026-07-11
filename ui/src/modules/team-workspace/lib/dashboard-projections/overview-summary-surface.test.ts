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
  it("keeps overview reports limited to latest daily and weekly cadence rows", () => {
    const config: FarplaneProjectConfig = {
      ok: true,
      projectPath: "/tmp/farplane",
      generatedAtMs: Date.UTC(2026, 6, 8),
      files: [],
      runtimeSources: [
        {
          id: "reports",
          label: "Reports",
          path: ".farplane/reports",
          kind: "directory",
          absolutePath: "/tmp/farplane/.farplane/reports",
          exists: true,
          updatedAtMs: Date.UTC(2026, 6, 8),
          childCount: null,
          reports: [
            {
              id: "reports/interval/daily_interval/2026-07-07T213501Z",
              ref: "reports/interval/daily_interval/2026-07-07T213501Z",
              groupRef: "reports/interval/daily_interval",
              label: "Daily interval",
              kind: "interval-report",
              path: ".farplane/reports/interval/daily_interval/2026-07-07T213501Z.md",
              absolutePath:
                "/tmp/farplane/.farplane/reports/interval/daily_interval/2026-07-07T213501Z.md",
              summary: "Daily summary",
              summaryRows: ["Daily summary"],
              frontMatter: { created_at: "2026-07-08T05:35:01+08:00" },
              createdAt: "2026-07-08T05:35:01+08:00",
              updatedAtMs: Date.UTC(2026, 6, 7),
            },
            {
              id: "reports/feed-scout/2026-07-07T213501Z",
              ref: "reports/feed-scout/2026-07-07T213501Z",
              label: "Feed scout",
              kind: "feed-scout-report",
              path: ".farplane/reports/feed-scout/2026-07-07T213501Z.md",
              absolutePath: "/tmp/farplane/.farplane/reports/feed-scout/2026-07-07T213501Z.md",
              summary: "Feed scout summary",
              summaryRows: ["Feed scout summary"],
              frontMatter: { created_at: "2026-07-08T05:35:01+08:00" },
              createdAt: "2026-07-08T05:35:01+08:00",
              updatedAtMs: Date.UTC(2026, 6, 7),
            },
            {
              id: "reports/interval/weekly_interval/2026-07-05T214922Z",
              ref: "reports/interval/weekly_interval/2026-07-05T214922Z",
              groupRef: "reports/interval/weekly_interval",
              label: "Weekly interval",
              kind: "interval-report",
              path: ".farplane/reports/interval/weekly_interval/2026-07-05T214922Z.md",
              absolutePath:
                "/tmp/farplane/.farplane/reports/interval/weekly_interval/2026-07-05T214922Z.md",
              summary: "Weekly summary",
              summaryRows: ["Weekly summary"],
              frontMatter: { created_at: "2026-07-06T05:49:22+08:00" },
              createdAt: "2026-07-06T05:49:22+08:00",
              updatedAtMs: Date.UTC(2026, 6, 5),
            },
          ],
        },
      ],
    };

    const surface = buildOverviewSummarySurface({
      aiBurn24hUsd: 0,
      projectConfig: config,
    });

    expect(surface.reports.map((report) => report.ref)).toEqual([
      "reports/interval/daily_interval/2026-07-07T213501Z",
      "reports/interval/weekly_interval/2026-07-05T214922Z",
    ]);
  });

  it("uses pinned metric readings as values instead of display mode strings", () => {
    const surface = buildOverviewSummarySurface({
      aiBurn24hUsd: 0,
      projectConfig: projectConfigWithSnapshot({
        generated_at: "2026-07-03T00:00:00Z",
        schema_version: 2,
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
            charter: {},
            pinned_metrics: ["accepted_evidence_cycles"],
            pinned_metric_cards: [],
            source_gap_ids: [],
          },
          objectives: { selection: { objectives: [], guards: [] }, metric_cards: [], source_gap_ids: [] },
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
        schema_version: 2,
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
            charter: {},
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
          },
          objectives: { selection: { objectives: [], guards: [] }, metric_cards: [], source_gap_ids: [] },
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
