import { describe, expect, it } from "vitest";
import { parseOverviewSurface } from "./overview-surface";

describe("overview surface model", () => {
  it("rejects unrelated or malformed JSON objects", () => {
    expect(parseOverviewSurface({})).toBeNull();
    expect(
      parseOverviewSurface({
        generated_at: "2026-07-01T00:00:00Z",
        project_id: "farplane-ui",
        pins: [],
      }),
    ).toBeNull();
  });

  it("parses max four ordered pins and source-backed attention rows", () => {
    const surface = parseOverviewSurface({
      generated_at: "2026-07-01T00:00:00Z",
      project_id: "farplane-ui",
      pins: [
        { id: "later", label: "Later", value: "1", priority: 5 },
        { id: "first", label: "First", value: "2", priority: 1, status: "available" },
        { id: "second", label: "Second", value: "3", priority: 2 },
        { id: "third", label: "Third", value: "4", priority: 3 },
        { id: "fourth", label: "Fourth", value: "5", priority: 4 },
      ],
      attention: [
        {
          id: "gap:x_retention_score",
          kind: "gap",
          title: "x_retention_score",
          attention_reason: "no available observation for metric",
          owner: "system",
        },
      ],
      reports: [
        {
          id: "daily",
          label: "Daily",
          path: ".farplane/reports/daily.md",
          summary: "Daily source gaps are closed.",
          summary_rows: ["Daily source gaps are closed.", "Next action is review."],
          content: "# Daily\n\nFull report.",
          interval_id: "daily_interval",
          front_matter: { created_at: "2026-07-02T05:36:11+08:00" },
        },
      ],
      sources: [
        {
          id: "metrics-ui",
          label: "Metrics",
          path: ".farplane/metrics/ui/latest.json",
          exists: true,
        },
      ],
    });

    expect(surface?.pins.map((pin) => pin.id)).toEqual(["first", "second", "third", "fourth"]);
    expect(surface?.attention[0].owner).toBe("system");
    expect(surface?.reports[0].summary).toBe("Daily source gaps are closed.");
    expect(surface?.reports[0].summaryRows).toEqual([
      "Daily source gaps are closed.",
      "Next action is review.",
    ]);
    expect(surface?.reports[0].content).toContain("Full report.");
    expect(surface?.reports[0].frontMatter?.created_at).toBe("2026-07-02T05:36:11+08:00");
    expect(surface?.sources[0].exists).toBe(true);
  });
});
