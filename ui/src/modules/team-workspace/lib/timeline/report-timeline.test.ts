import { describe, expect, it } from "vitest";
import type { FarplaneRuntimeReport } from "@/modules/team-workspace/lib/project-config";
import { reportMatchesTimelinePatterns, reportToTimelineRow } from "./report-timeline";
import { DEFAULT_TIMELINE_REPORT_PATTERNS } from "./timeline-page-types";

function report(overrides: Partial<FarplaneRuntimeReport>): FarplaneRuntimeReport {
  return {
    id: "reports/interval/daily_interval/2026-07-08T000000Z",
    ref: "reports/interval/daily_interval/2026-07-08T000000Z",
    label: "Daily interval",
    kind: "interval-report",
    path: ".farplane/reports/interval/daily_interval/2026-07-08T000000Z.md",
    absolutePath: "/tmp/.farplane/reports/interval/daily_interval/2026-07-08T000000Z.md",
    frontMatter: { created_at: "2026-07-08T00:00:00Z" },
    createdAt: "2026-07-08T00:00:00Z",
    updatedAtMs: Date.UTC(2026, 6, 8),
    ...overrides,
  };
}

describe("report timeline helpers", () => {
  it("includes daily and weekly reports but excludes pulse by default", () => {
    expect(reportMatchesTimelinePatterns(report({}), DEFAULT_TIMELINE_REPORT_PATTERNS)).toBe(true);
    expect(
      reportMatchesTimelinePatterns(
        report({
          ref: "reports/pulse/2026-07-08T000000Z",
          path: ".farplane/reports/pulse/2026-07-08T000000Z.md",
        }),
        DEFAULT_TIMELINE_REPORT_PATTERNS,
      ),
    ).toBe(false);
  });

  it("converts a registry report into a timestamped timeline row", () => {
    expect(reportToTimelineRow(report({}), "project-a")).toMatchObject({
      _id: "report:reports/interval/daily_interval/2026-07-08T000000Z",
      sourceType: "report_event",
      eventType: "report.generated",
      occurredAt: Date.UTC(2026, 6, 8),
      projectId: "project-a",
      reportKind: "interval-report",
      reportRef: "reports/interval/daily_interval/2026-07-08T000000Z",
    });
  });
});
