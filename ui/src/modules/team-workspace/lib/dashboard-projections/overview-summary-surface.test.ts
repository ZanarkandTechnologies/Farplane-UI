import { describe, expect, it } from "vitest";
import type { FarplaneProjectConfig } from "@/modules/team-workspace/lib/project-config";
import autonomySnapshot from "./fixtures/autonomy-savings-snapshot-v2.json";
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
  it("projects flat autonomy cards into measured, attributed, and estimated states", () => {
    const surface = buildOverviewSummarySurface({
      aiBurn24hUsd: 0,
      projectConfig: projectConfigWithSnapshot(autonomySnapshot),
    });

    expect(surface.autonomySavings?.attributionCoverage).toBe(0.75);
    expect(surface.autonomySavings?.metrics).toHaveLength(5);
    expect(surface.autonomySavings?.metrics[0]).toMatchObject({
      id: "clone_hours",
      value: "8h",
      evidenceKind: "measured",
    });
    expect(surface.autonomySavings?.metrics[4]).toMatchObject({
      id: "potential_human_time_saved_hours_estimated",
      value: "5.5h",
      evidenceKind: "estimated",
    });
  });

  it("keeps partial, stale, and source-gap autonomy readings unknown", () => {
    const partial = structuredClone(autonomySnapshot);
    partial.metrics.series = partial.metrics.series.slice(0, 3).map((metric, index) => {
      if (index === 1) return { ...metric, status: "stale", current: null } as never;
      if (index === 2) {
        return {
          ...metric,
          status: "source_gap",
          current: null,
          source_gaps: [
            {
              date: "2026-07-12",
              status: "source_gap",
              reason: "missing_acceptance_evidence",
            },
          ],
        } as never;
      }
      return metric;
    });

    const surface = buildOverviewSummarySurface({
      aiBurn24hUsd: 0,
      projectConfig: projectConfigWithSnapshot(partial),
    });

    expect(surface.autonomySavings?.metrics.map((metric) => [metric.id, metric.value])).toEqual([
      ["clone_hours", "8h"],
      ["concurrent_agent_wall_hours", "stale"],
      ["accepted_clone_hours", "source gap"],
    ]);
    expect(surface.autonomySavings?.sourceGaps).toHaveLength(2);
  });

  it("omits the autonomy presentation when none of its flat cards exist", () => {
    const snapshot = structuredClone(autonomySnapshot);
    snapshot.metrics.series = [];
    const surface = buildOverviewSummarySurface({
      aiBurn24hUsd: 0,
      projectConfig: projectConfigWithSnapshot(snapshot),
    });
    expect(surface.autonomySavings).toBeUndefined();
  });
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
          objectives: {
            selection: { objectives: [], guards: [] },
            metric_cards: [],
            source_gap_ids: [],
          },
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
          objectives: {
            selection: { objectives: [], guards: [] },
            metric_cards: [],
            source_gap_ids: [],
          },
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

  it("maps only active-team highlights and keeps newest cards first", () => {
    const surface = buildOverviewSummarySurface({
      aiBurn24hUsd: 0,
      teamScope: "codex-proj-users-kenjipcx-zanarkand-technologies-projects-farplane",
      projectConfig: projectConfigWithSnapshot({
        generated_at: "2026-07-24T00:00:00Z",
        schema_version: 2,
        project: { id: "proj-farplane" },
        source_gaps: [],
        metrics: { contents: [], primitives: {}, readings: {}, series: [] },
        tabs: {
          overview: {
            charter: {},
            pinned_metrics: [],
            pinned_metric_cards: [],
            source_gap_ids: [],
          },
          objectives: {
            selection: { objectives: [], guards: [] },
            metric_cards: [],
            source_gap_ids: [],
          },
          highlights: {
            wins: [
              {
                id: "win:farplane:older",
                kind: "win",
                team: "farplane",
                report: "reports/interval/daily_interval/older",
                summary: "Older record.",
                links: [],
                created_at: "2026-07-20T00:00:00Z",
              },
              {
                id: "win:other:newer",
                kind: "win",
                team: "other",
                report: "reports/interval/daily_interval/other",
                summary: "Other team's record.",
                links: [],
                created_at: "2026-07-24T00:00:00Z",
              },
              {
                id: "win:farplane:newer",
                kind: "win",
                team: "farplane",
                report: "reports/interval/weekly_interval/newer",
                summary: "Newer record.",
                links: [{ label: "Evidence", href: "tickets/TASK-0405/ticket.md#proof" }],
                created_at: "2026-07-23T00:00:00Z",
                source_href: ".farplane/reports/interval/weekly.md",
              },
            ],
            failures: [
              {
                id: "failure:farplane",
                kind: "failure",
                team: "farplane",
                report: "reports/interval/weekly_interval/failure",
                summary: "Coordination exceeded the task.",
                lesson: "Keep simple work in one lane.",
                links: [],
                created_at: "2026-07-22T00:00:00Z",
              },
            ],
            source_gap_ids: [],
          },
        },
      }),
    });

    expect(surface.wins.map((card) => card.id)).toEqual([
      "win:farplane:newer",
      "win:farplane:older",
    ]);
    expect(surface.failures[0]).toMatchObject({
      team: "farplane",
      lesson: "Keep simple work in one lane.",
    });
    expect(surface.wins[0]?.links[0]).toEqual({
      label: "Evidence",
      href: "/farplane/project-file?projectPath=%2Ftmp%2Ffarplane&ref=tickets%2FTASK-0405%2Fticket.md#proof",
    });
    expect(surface.wins[0]?.sourceHref).toBe(
      "/farplane/project-file?projectPath=%2Ftmp%2Ffarplane&ref=.farplane%2Freports%2Finterval%2Fweekly.md",
    );
  });
});
