import { describe, expect, it } from "vitest";
import autonomySnapshot from "./fixtures/autonomy-savings-snapshot-v2.json";
import { parseProjectUiSnapshot, sourceGapText } from "./project-ui-snapshot";

function contractSnapshot() {
  return {
    generated_at: "2026-07-12T00:00:00Z",
    schema_version: 2,
    project: { id: "farplane", name: "Farplane" },
    source_gaps: [
      {
        id: "stale_guard",
        message: "guard is stale",
        owner: "metrics",
        severity: "hard_guard",
        source_ref: { path: "farplane/metrics.yaml" },
      },
    ],
    metrics: {
      contents: [],
      primitives: {},
      readings: {},
      definitions: {
        quality: {
          metric_id: "quality",
          label: "Quality",
          description: "Eval pass rate.",
          direction: "maximize",
          max_age_days: 7,
          selection_role: "guard",
          unit: "ratio",
        },
      },
      series: [],
    },
    tabs: {
      overview: {
        charter: {
          mission: "Make useful work.",
          north_star: "Reliable agents.",
          human_thesis: "Humans retain control.",
          operating_principles: ["visible proof"],
          non_tradeoffs: ["no hidden state"],
          stable_capabilities: ["pulse-update"],
        },
        pinned_metrics: [],
        pinned_metric_cards: [],
        primitive_summary: {},
        source_gap_ids: [],
      },
      objectives: {
        selection: { objectives: [], guards: [{ metric_id: "quality", scope: "project" }] },
        metric_cards: [
          {
            metric_id: "quality",
            label: "Quality",
            status: "stale",
            current: null,
            unit: "ratio",
            series: [{ date: "2026-07-01", value: 1 }],
            source_gaps: [
              {
                date: "2026-07-01",
                status: "stale",
                reason: "latest observation is 10 days old; max_age_days=7",
              },
            ],
          },
        ],
        source_gap_ids: ["stale_guard"],
      },
      cadence: {
        automations: [{ id: "pulse", name: "Work Pulse", kind: "heartbeat", status: "active" }],
        source_gap_ids: [],
      },
      distribution: {
        content_items: [],
        content_metric_cards: [],
        content_metric_ids: [],
        source_gap_ids: [],
      },
      highlights: {
        wins: [
          {
            id: "win:farplane:daily-2026-07-12",
            kind: "win",
            team: "farplane",
            project_id: "farplane",
            report: "reports/interval/daily_interval/2026-07-12T000000Z",
            summary: "Evidence reach beat the previous record by 42%.",
            links: [
              { label: "Metric evidence", href: "file:///tmp/farplane/evidence.json" },
              "https://example.com/proof",
            ],
            cadence: "daily",
            period: "2026-07-12",
            created_at: "2026-07-12T00:00:00Z",
            source_href: "file:///tmp/farplane/daily.md",
          },
        ],
        failures: [
          {
            id: "failure:farplane:weekly-2026-W28",
            kind: "failure",
            team: "farplane",
            report: "reports/interval/weekly_interval/2026-07-12T000000Z",
            summary: "A simple check was split across too many agents.",
            lesson: "Do not delegate when the job is simpler than the handoff.",
            links: [],
            cadence: "weekly",
            period: "2026-W28",
            created_at: "2026-07-12T00:00:00Z",
            source_gap_ids: ["highlight_report_missing"],
          },
        ],
        source_gap_ids: ["highlight_report_missing"],
      },
    },
  };
}

describe("project UI snapshot model", () => {
  it("parses schema 2 charter, objective selection, definitions, and stale guards", () => {
    const snapshot = parseProjectUiSnapshot(contractSnapshot());
    expect(snapshot?.tabs.overview.charter.mission).toBe("Make useful work.");
    expect(snapshot?.tabs.objectives.guards[0]).toMatchObject({
      metricId: "quality",
      scope: "project",
    });
    expect(snapshot?.tabs.objectives.metricCards[0]).toMatchObject({
      status: "stale",
      current: null,
    });
    expect(snapshot?.metrics.definitions[0]).toMatchObject({
      direction: "maximize",
      maxAgeDays: 7,
      selectionRole: "guard",
    });
    expect(sourceGapText(snapshot, ["stale_guard"])[0].path).toBe("farplane/metrics.yaml");
  });

  it("parses cadence without goals or products", () => {
    const snapshot = parseProjectUiSnapshot(contractSnapshot());
    expect(snapshot?.tabs.cadence.automations[0]).toMatchObject({ kind: "heartbeat" });
    expect("goals" in (snapshot?.tabs ?? {})).toBe(false);
    expect("products" in (snapshot?.tabs ?? {})).toBe(false);
  });

  it("rejects a legacy goals-only snapshot", () => {
    expect(
      parseProjectUiSnapshot({ generated_at: "2026-07-12T00:00:00Z", tabs: { goals: {} } }),
    ).toBeNull();
  });

  it("preserves generic observation payload provenance on flat schema-v2 cards", () => {
    const snapshot = parseProjectUiSnapshot(autonomySnapshot);
    expect(snapshot?.metrics.series[0]?.series[0]?.payload).toMatchObject({
      attribution_coverage: 0.75,
    });
  });

  it("parses optional highlight cards and generic links", () => {
    const highlights = parseProjectUiSnapshot(contractSnapshot())?.tabs.highlights;

    expect(highlights?.wins[0]).toMatchObject({
      kind: "win",
      team: "farplane",
      projectId: "farplane",
      summary: "Evidence reach beat the previous record by 42%.",
      cadence: "daily",
      period: "2026-07-12",
      sourceHref: "file:///tmp/farplane/daily.md",
    });
    expect(highlights?.wins[0]?.links).toEqual([
      { label: "Metric evidence", href: "file:///tmp/farplane/evidence.json" },
      { label: "https://example.com/proof", href: "https://example.com/proof" },
    ]);
    expect(highlights?.failures[0]?.lesson).toBe(
      "Do not delegate when the job is simpler than the handoff.",
    );
    expect(highlights?.sourceGapIds).toEqual(["highlight_report_missing"]);
  });

  it("keeps schema-v2 compatibility when highlights are absent and drops invalid rows", () => {
    const absent = contractSnapshot();
    delete (absent.tabs as Partial<typeof absent.tabs>).highlights;
    expect(parseProjectUiSnapshot(absent)?.tabs.highlights).toBeUndefined();

    const malformed = contractSnapshot();
    malformed.tabs.highlights.failures.push({
      id: "failure:missing-lesson",
      kind: "failure",
      team: "farplane",
      report: "reports/interval/daily_interval/missing-lesson",
      summary: "This row has no reusable lesson.",
      lesson: "",
      links: [],
      cadence: "daily",
      period: "2026-07-12",
      created_at: "2026-07-12T00:00:00Z",
      source_gap_ids: [],
    });
    malformed.tabs.highlights.wins.push({
      id: "",
      kind: "win",
      team: "farplane",
      project_id: "farplane",
      report: "reports/interval/daily_interval/no-id",
      summary: "No stable card identity.",
      links: [],
      cadence: "daily",
      period: "2026-07-12",
      created_at: "2026-07-12T00:00:00Z",
      source_href: "",
    });

    const highlights = parseProjectUiSnapshot(malformed)?.tabs.highlights;
    expect(highlights?.wins).toHaveLength(1);
    expect(highlights?.failures).toHaveLength(1);
  });
});
