import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { FarplaneProjectConfig } from "../project-config";
import { HighlightsGalleryTab } from "./highlights-gallery-tab";

function projectConfig(): FarplaneProjectConfig {
  return {
    ok: true,
    generatedAtMs: Date.parse("2026-07-25T00:00:00Z"),
    projectPath: "/tmp/farplane",
    files: [],
    runtimeSources: [
      {
        id: "project-ui",
        label: "Project UI",
        path: ".farplane/project/ui/latest.json",
        kind: "file",
        absolutePath: "/tmp/farplane/.farplane/project/ui/latest.json",
        exists: true,
        updatedAtMs: Date.parse("2026-07-25T00:00:00Z"),
        childCount: null,
        parsedJson: {
          generated_at: "2026-07-25T00:00:00Z",
          schema_version: 3,
          project_root: "/tmp/farplane",
          project: { id: "farplane" },
          sources: [],
          source_gaps: [],
          metrics: {
            contents: [],
            definitions: [],
            primitives: {},
            readings: {},
            series: [],
          },
          tabs: {
            overview: {
              charter: {},
              pinned_metrics: [],
              pinned_metric_cards: [],
            },
            objectives: {
              selection: { objectives: [], guards: [] },
              metric_cards: [],
              source_gap_ids: [],
            },
            highlights: {
              wins: [
                {
                  id: "win-1",
                  kind: "win",
                  team: "farplane",
                  report: "daily",
                  summary: "Qualified reach set a new record.",
                  links: [],
                },
              ],
              failures: [
                {
                  id: "failure-1",
                  kind: "failure",
                  team: "farplane",
                  report: "reports/interval/daily/2026-07-24",
                  summary: "A simple check crossed three handoffs.",
                  lesson: "Keep small verification jobs in one pair of hands.",
                  links: [],
                  cadence: "daily",
                  period: "2026-07-24",
                  created_at: "2026-07-24T12:00:00Z",
                },
                {
                  id: "failure-weekly-duplicate",
                  kind: "failure",
                  team: "farplane",
                  report: "reports/interval/weekly/2026-07-24",
                  summary: "The weekly summary repeated the daily failure.",
                  lesson: "This weekly row must not become another card.",
                  links: [],
                  cadence: "weekly",
                  period: "2026-07-24",
                  created_at: "2026-07-24T13:00:00Z",
                },
                {
                  id: "failure-daily-duplicate",
                  kind: "failure",
                  team: "farplane",
                  report: "reports/interval/daily/2026-07-24-older",
                  summary: "An older daily candidate for the same day.",
                  lesson: "This older same-day row must collapse.",
                  links: [],
                  cadence: "daily",
                  period: "2026-07-24",
                  created_at: "2026-07-24T10:00:00Z",
                },
              ],
              source_gap_ids: [],
            },
          },
        },
      },
    ],
  };
}

describe("HighlightsGalleryTab", () => {
  it("renders wins as a full gallery destination", () => {
    const html = renderToStaticMarkup(
      createElement(HighlightsGalleryTab, {
        kind: "wins",
        projectConfig: projectConfig(),
        projectConfigState: "ready",
        teamScope: "team-farplane",
      }),
    );

    expect(html).toContain('id="wins-gallery-title"');
    expect(html).toContain("Qualified reach set a new record.");
    expect(html).toContain("1 entry");
  });

  it("leads failure cards with the reusable lesson and retains failure context", () => {
    const html = renderToStaticMarkup(
      createElement(HighlightsGalleryTab, {
        kind: "failures",
        projectConfig: projectConfig(),
        projectConfigState: "ready",
        teamScope: "team-farplane",
      }),
    );

    expect(html).toContain('id="failures-gallery-title"');
    expect(html).toContain("Failures");
    expect(html).toContain("Keep small verification jobs in one pair of hands.");
    expect(html).toContain("Daily failures, grouped by review week.");
    expect(html).toContain("Daily Failures");
    expect(html).not.toContain("Vote");
    expect(html).not.toContain("Leading this week");
    expect(html).toContain("1 day");
    expect(html).not.toContain("This weekly row must not become another card.");
    expect(html).not.toContain("This older same-day row must collapse.");
    expect(html).toContain("A simple check crossed three handoffs.");
  });
});
