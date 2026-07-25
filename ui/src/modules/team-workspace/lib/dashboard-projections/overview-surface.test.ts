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
          ref: "reports/interval/daily_interval/2026-07-02T053611+0800",
          parent_ref: "reports/interval/daily_interval",
          children_refs: ["reports/interval/daily_interval/2026-07-02T053611+0800/feed-scout"],
          ancestor_refs: ["reports", "reports/interval", "reports/interval/daily_interval"],
          group_ref: "reports/interval/daily_interval",
          depth: 4,
          label: "Daily",
          kind: "interval-report",
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
          id: "project-ui",
          label: "Metrics",
          path: ".farplane/project/ui/latest.json",
          exists: true,
        },
      ],
      wins: [
        {
          id: "win:farplane:daily",
          kind: "win",
          team: "farplane",
          report: "reports/interval/daily_interval/2026-07-01",
          summary: "A verified metric set a new daily record.",
          links: [{ label: "Evidence", href: "https://example.com/evidence" }],
          cadence: "daily",
          period: "2026-07-01",
        },
      ],
      failures: [
        {
          id: "failure:farplane:weekly",
          kind: "failure",
          team: "farplane",
          report: "reports/interval/weekly_interval/2026-W27",
          summary: "A simple task accumulated coordination overhead.",
          lesson: "Keep simple work in one lane.",
          links: [],
          cadence: "weekly",
          period: "2026-W27",
        },
        {
          id: "failure:missing-lesson",
          kind: "failure",
          team: "farplane",
          report: "reports/interval/daily_interval/invalid",
          summary: "Invalid because the lesson is absent.",
        },
      ],
    });

    expect(surface?.pins.map((pin) => pin.id)).toEqual(["first", "second", "third", "fourth"]);
    expect(surface?.attention[0].owner).toBe("system");
    expect(surface?.reports[0].summary).toBe("Daily source gaps are closed.");
    expect(surface?.reports[0].ref).toBe("reports/interval/daily_interval/2026-07-02T053611+0800");
    expect(surface?.reports[0].parentRef).toBe("reports/interval/daily_interval");
    expect(surface?.reports[0].childRefs).toEqual([
      "reports/interval/daily_interval/2026-07-02T053611+0800/feed-scout",
    ]);
    expect(surface?.reports[0].ancestorRefs).toEqual([
      "reports",
      "reports/interval",
      "reports/interval/daily_interval",
    ]);
    expect(surface?.reports[0].groupRef).toBe("reports/interval/daily_interval");
    expect(surface?.reports[0].depth).toBe(4);
    expect(surface?.reports[0].kind).toBe("interval-report");
    expect(surface?.reports[0].summaryRows).toEqual([
      "Daily source gaps are closed.",
      "Next action is review.",
    ]);
    expect(surface?.reports[0].content).toContain("Full report.");
    expect(surface?.reports[0].frontMatter?.created_at).toBe("2026-07-02T05:36:11+08:00");
    expect(surface?.sources[0].exists).toBe(true);
    expect(surface?.wins[0]?.links[0]).toEqual({
      label: "Evidence",
      href: "https://example.com/evidence",
    });
    expect(surface?.failures).toHaveLength(1);
    expect(surface?.failures[0]?.lesson).toBe("Keep simple work in one lane.");
  });
});
