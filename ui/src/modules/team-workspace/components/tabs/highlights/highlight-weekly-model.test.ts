import { describe, expect, it } from "vitest";
import type { OverviewHighlightCard } from "@/modules/team-workspace/lib/dashboard-projections/overview-surface";
import { buildFailureWeekGroups } from "./highlight-weekly-model";

function failure(id: string, period: string): OverviewHighlightCard {
  return {
    id,
    kind: "failure",
    team: "farplane-ui",
    report: `reports/interval/daily/${period}`,
    summary: `${id} happened`,
    lesson: `${id} lesson`,
    links: [],
    cadence: "daily",
    period,
    createdAt: `${period}T12:00:00Z`,
    sourceGapIds: [],
  };
}

describe("highlight weekly model", () => {
  it("groups daily cards into Monday-based weeks newest first", () => {
    const groups = buildFailureWeekGroups([
      failure("highlight:failure:one", "2026-07-13"),
      failure("highlight:failure:two", "2026-07-20"),
      failure("highlight:failure:three", "2026-07-26"),
    ]);

    expect(groups.map((group) => [group.id, group.cards.length])).toEqual([
      ["2026-07-20", 2],
      ["2026-07-13", 1],
    ]);
    expect(groups[0]?.label).toBe("Jul 20–Jul 26");
  });
});
