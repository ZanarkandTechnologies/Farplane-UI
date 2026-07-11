import { describe, expect, it } from "vitest";
import { parseProjectUiSnapshot, sourceGapText } from "./project-ui-snapshot";

function contractSnapshot() {
  return {
    generated_at: "2026-07-12T00:00:00Z",
    schema_version: 2,
    project: { id: "farplane", name: "Farplane" },
    source_gaps: [{ id: "stale_guard", message: "guard is stale", owner: "metrics", severity: "hard_guard", source_ref: { path: "farplane/metrics.yaml" } }],
    metrics: {
      contents: [], primitives: {}, readings: {},
      definitions: {
        quality: { metric_id: "quality", label: "Quality", description: "Eval pass rate.", direction: "maximize", max_age_days: 7, selection_role: "guard", unit: "ratio" },
      },
      series: [],
    },
    tabs: {
      overview: {
        charter: { mission: "Make useful work.", north_star: "Reliable agents.", human_thesis: "Humans retain control.", operating_principles: ["visible proof"], non_tradeoffs: ["no hidden state"], stable_capabilities: ["pulse-update"] },
        pinned_metrics: [], pinned_metric_cards: [], primitive_summary: {}, source_gap_ids: [],
      },
      objectives: {
        selection: { objectives: [], guards: [{ metric_id: "quality", scope: "project" }] },
        metric_cards: [{ metric_id: "quality", label: "Quality", status: "stale", current: null, unit: "ratio", series: [{ date: "2026-07-01", value: 1 }], source_gaps: [{ date: "2026-07-01", status: "stale", reason: "latest observation is 10 days old; max_age_days=7" }] }],
        source_gap_ids: ["stale_guard"],
      },
      cadence: { automations: [{ id: "pulse", name: "Work Pulse", kind: "heartbeat", status: "active" }], source_gap_ids: [] },
      distribution: { content_items: [], content_metric_cards: [], content_metric_ids: [], source_gap_ids: [] },
    },
  };
}

describe("project UI snapshot model", () => {
  it("parses schema 2 charter, objective selection, definitions, and stale guards", () => {
    const snapshot = parseProjectUiSnapshot(contractSnapshot());
    expect(snapshot?.tabs.overview.charter.mission).toBe("Make useful work.");
    expect(snapshot?.tabs.objectives.guards[0]).toMatchObject({ metricId: "quality", scope: "project" });
    expect(snapshot?.tabs.objectives.metricCards[0]).toMatchObject({ status: "stale", current: null });
    expect(snapshot?.metrics.definitions[0]).toMatchObject({ direction: "maximize", maxAgeDays: 7, selectionRole: "guard" });
    expect(sourceGapText(snapshot, ["stale_guard"])[0].path).toBe("farplane/metrics.yaml");
  });

  it("parses cadence without goals or products", () => {
    const snapshot = parseProjectUiSnapshot(contractSnapshot());
    expect(snapshot?.tabs.cadence.automations[0]).toMatchObject({ kind: "heartbeat" });
    expect("goals" in (snapshot?.tabs ?? {})).toBe(false);
    expect("products" in (snapshot?.tabs ?? {})).toBe(false);
  });

  it("rejects a legacy goals-only snapshot", () => {
    expect(parseProjectUiSnapshot({ generated_at: "2026-07-12T00:00:00Z", tabs: { goals: {} } })).toBeNull();
  });
});
